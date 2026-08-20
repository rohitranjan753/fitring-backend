import cors from 'cors';
import express from 'express';
import { authRouter } from './auth/auth.routes';
import { cartRouter } from './cart/cart.routes';
import { devicesRouter } from './devices/devices.routes';
import { healthRouter } from './health/health.routes';
import { errorHandler } from './middleware/error-handler';
import { ordersRouter } from './orders/orders.routes';
import { productsRouter } from './products/products.routes';

export const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ service: 'fitring-companion-backend', status: 'ok' });
});

app.use('/auth', authRouter);
app.use('/devices', devicesRouter);
app.use('/health', healthRouter);
app.use('/products', productsRouter);
app.use('/cart', cartRouter);
app.use('/orders', ordersRouter);

app.use(errorHandler);
