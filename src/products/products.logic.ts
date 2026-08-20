import { DataSource } from 'typeorm';
import { Product } from '../entities/product.entity';
import { NotFoundError } from '../errors/http-error';

export function findAllProducts(dataSource: DataSource): Promise<Product[]> {
  return dataSource.getRepository(Product).find({ order: { name: 'ASC' } });
}

export async function findProduct(
  dataSource: DataSource,
  id: string,
): Promise<Product> {
  const product = await dataSource
    .getRepository(Product)
    .findOne({ where: { id } });
  if (!product) throw new NotFoundError('Product not found');
  return product;
}
