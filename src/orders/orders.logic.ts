import { DataSource } from 'typeorm';
import { CartItem } from '../entities/cart-item.entity';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { BadRequestError } from '../errors/http-error';

/**
 * Cart -> order in a single transaction: create the order with its items
 * (price snapshotted from the product at this moment, so a later catalog
 * price change never rewrites order history), then clear the cart. Either
 * both happen or neither does.
 */
export async function placeOrder(
  dataSource: DataSource,
  userId: string,
): Promise<Order> {
  return dataSource.transaction(async (manager) => {
    const cartItems = await manager.find(CartItem, { where: { userId } });
    if (cartItems.length === 0) {
      throw new BadRequestError('Cart is empty');
    }

    const totalAmount = cartItems
      .reduce(
        (sum, item) => sum + parseFloat(item.product.price) * item.quantity,
        0,
      )
      .toFixed(2);

    const order = await manager.save(
      Order,
      manager.create(Order, {
        userId,
        totalAmount,
        items: cartItems.map((item) =>
          manager.create(OrderItem, {
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.product.price,
          }),
        ),
      }),
    );

    await manager.delete(CartItem, { userId });

    return order;
  });
}

export function findOrdersForUser(
  dataSource: DataSource,
  userId: string,
): Promise<Order[]> {
  return dataSource
    .getRepository(Order)
    .find({ where: { userId }, order: { createdAt: 'DESC' } });
}
