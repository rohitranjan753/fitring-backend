import { DataSource } from 'typeorm';
import { CartItem } from '../entities/cart-item.entity';
import { Order } from '../entities/order.entity';
import { BadRequestError } from '../errors/http-error';
import { placeOrder } from './orders.logic';

interface MockManager {
  find: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  delete: jest.Mock;
}

function fakeDataSource(manager: MockManager): DataSource {
  return {
    transaction: (cb: (manager: MockManager) => Promise<unknown>) =>
      cb(manager),
  } as unknown as DataSource;
}

describe('orders.logic placeOrder', () => {
  let manager: MockManager;

  beforeEach(() => {
    manager = {
      find: jest.fn(),
      // mirrors TypeORM's manager.create(Entity, data) -> data
      create: jest.fn((_entity: unknown, data: unknown) => data),
      save: jest.fn((_entity: unknown, data: unknown) =>
        Promise.resolve({ id: 'order-1', ...(data as object) }),
      ),
      delete: jest.fn(),
    };
  });

  it('refuses to place an order from an empty cart', async () => {
    manager.find.mockResolvedValue([]);

    await expect(placeOrder(fakeDataSource(manager), 'user-1')).rejects.toThrow(
      BadRequestError,
    );
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('snapshots product prices into the order and computes the correct total', async () => {
    manager.find.mockResolvedValue([
      { productId: 'p1', quantity: 2, product: { price: '10.00' } },
      { productId: 'p2', quantity: 1, product: { price: '5.50' } },
    ]);

    const order = (await placeOrder(
      fakeDataSource(manager),
      'user-1',
    )) as unknown as {
      totalAmount: string;
      items: { productId: string; quantity: number; unitPrice: string }[];
    };

    expect(order.totalAmount).toBe('25.50');
    expect(order.items).toEqual([
      expect.objectContaining({
        productId: 'p1',
        quantity: 2,
        unitPrice: '10.00',
      }),
      expect.objectContaining({
        productId: 'p2',
        quantity: 1,
        unitPrice: '5.50',
      }),
    ]);
  });

  it("includes each item's product on the returned order, matching what GET /orders returns", async () => {
    // Regression: OrderItem.product is eager-loaded when re-queried (GET
    // /orders), but manager.create() here builds an in-memory OrderItem
    // that's never re-fetched — if `product` isn't set explicitly, this
    // response silently omits it while GET /orders includes it, and the
    // mobile client's shared Order parser (which requires `product` on
    // every item) throws on the inconsistent shape.
    const product = { price: '10.00', name: 'FitRing Charging Dock' };
    manager.find.mockResolvedValue([{ productId: 'p1', quantity: 2, product }]);

    const order = (await placeOrder(
      fakeDataSource(manager),
      'user-1',
    )) as unknown as { items: { product: unknown }[] };

    expect(order.items[0].product).toBe(product);
  });

  it('clears the cart only after the order is created, in the same transaction', async () => {
    manager.find.mockResolvedValue([
      { productId: 'p1', quantity: 1, product: { price: '10.00' } },
    ]);

    await placeOrder(fakeDataSource(manager), 'user-1');

    expect(manager.delete).toHaveBeenCalledWith(CartItem, { userId: 'user-1' });
    // save() must be called before delete() — an order should never be
    // "created" after its cart was already wiped.
    const saveOrder = manager.save.mock.invocationCallOrder[0];
    const deleteOrder = manager.delete.mock.invocationCallOrder[0];
    expect(saveOrder).toBeLessThan(deleteOrder);
  });

  it('saves the order via the Order entity', async () => {
    manager.find.mockResolvedValue([
      { productId: 'p1', quantity: 1, product: { price: '10.00' } },
    ]);

    await placeOrder(fakeDataSource(manager), 'user-1');

    expect(manager.save).toHaveBeenCalledWith(
      Order,
      expect.objectContaining({ userId: 'user-1' }),
    );
  });
});
