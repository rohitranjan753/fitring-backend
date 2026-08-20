import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from './env';
import { User } from '../entities/user.entity';
import { Device } from '../entities/device.entity';
import { HealthReading } from '../entities/health-reading.entity';
import { Product } from '../entities/product.entity';
import { CartItem } from '../entities/cart-item.entity';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';

// DataSource
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env.databaseUrl,
  entities: [User, Device, HealthReading, Product, CartItem, Order, OrderItem],
  synchronize: env.dbSynchronize,
  logging: env.dbLogging,
  ssl: env.dbSsl ? { rejectUnauthorized: false } : false,
});
