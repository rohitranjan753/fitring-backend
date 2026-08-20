import { DataSource } from 'typeorm';
import { CartItem } from '../entities/cart-item.entity';
import { Product } from '../entities/product.entity';
import { NotFoundError } from '../errors/http-error';
import { addOrUpdateCartItem, findCartForUser } from './cart.logic';

interface MockCartItemRepo {
  findOne: jest.Mock;
  find: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
}

/** Standing in for a real DataSource: routes getRepository(Product) to a
 * fixed product lookup, and getRepository(CartItem) to a mock repo — the
 * same seam addOrUpdateCartItem/findCartForUser actually use. */
function fakeDataSource(
  cartItems: MockCartItemRepo,
  product: Product | null = { id: 'p1', price: '10.00' } as Product,
): DataSource {
  return {
    getRepository: (entity: unknown) => {
      if (entity === Product) {
        return { findOne: jest.fn().mockResolvedValue(product) };
      }
      if (entity === CartItem) {
        return cartItems;
      }
      throw new Error('unexpected entity requested in test');
    },
  } as unknown as DataSource;
}

function makeCartItemRepo(): MockCartItemRepo {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((data: unknown) => data),
    save: jest.fn((data: unknown) => Promise.resolve(data)),
  };
}

describe('cart.logic addOrUpdateCartItem', () => {
  it('creates a new line when none exists for this (userId, productId)', async () => {
    const cartItems = makeCartItemRepo();

    const result = await addOrUpdateCartItem(
      fakeDataSource(cartItems),
      'user-1',
      'p1',
      2,
    );

    expect(cartItems.create).toHaveBeenCalledWith({
      userId: 'user-1',
      productId: 'p1',
      quantity: 2,
    });
    expect(result).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        productId: 'p1',
        quantity: 2,
      }),
    );
  });

  it('sets the quantity on an existing line rather than incrementing it', async () => {
    const cartItems = makeCartItemRepo();
    const existing = { userId: 'user-1', productId: 'p1', quantity: 3 };
    cartItems.findOne.mockResolvedValue(existing);

    const result = await addOrUpdateCartItem(
      fakeDataSource(cartItems),
      'user-1',
      'p1',
      5,
    );

    expect(cartItems.create).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ quantity: 5 }));
  });

  it('refuses to add a product that does not exist', async () => {
    const cartItems = makeCartItemRepo();

    await expect(
      addOrUpdateCartItem(
        fakeDataSource(cartItems, null),
        'user-1',
        'missing',
        1,
      ),
    ).rejects.toThrow(NotFoundError);
    expect(cartItems.save).not.toHaveBeenCalled();
  });
});

describe('cart.logic findCartForUser', () => {
  it("computes the total from each line's product price times quantity", async () => {
    const cartItems = makeCartItemRepo();
    cartItems.find.mockResolvedValue([
      { quantity: 2, product: { price: '10.00' } },
      { quantity: 1, product: { price: '5.50' } },
    ]);

    const result = await findCartForUser(fakeDataSource(cartItems), 'user-1');

    expect(result.total).toBe('25.50');
    expect(result.items).toHaveLength(2);
  });

  it('returns a zero total for an empty cart', async () => {
    const cartItems = makeCartItemRepo();

    const result = await findCartForUser(fakeDataSource(cartItems), 'user-1');

    expect(result).toEqual({ items: [], total: '0.00' });
  });
});
