import { DataSource } from 'typeorm';
import { CartItem } from '../entities/cart-item.entity';
import { findProduct } from '../products/products.logic';

/** Upsert on (userId, productId) — sets the line's quantity, not an increment. */
export async function addOrUpdateCartItem(
  dataSource: DataSource,
  userId: string,
  productId: string,
  quantity: number,
): Promise<CartItem> {
  await findProduct(dataSource, productId); // throws NotFoundError if missing

  const items = dataSource.getRepository(CartItem);
  const existing = await items.findOne({ where: { userId, productId } });
  if (existing) {
    existing.quantity = quantity;
    return items.save(existing);
  }
  return items.save(items.create({ userId, productId, quantity }));
}

export async function findCartForUser(
  dataSource: DataSource,
  userId: string,
): Promise<{ items: CartItem[]; total: string }> {
  const items = await dataSource
    .getRepository(CartItem)
    .find({ where: { userId }, order: { createdAt: 'ASC' } });
  const total = items.reduce(
    (sum, item) => sum + parseFloat(item.product.price) * item.quantity,
    0,
  );
  return { items, total: total.toFixed(2) };
}
