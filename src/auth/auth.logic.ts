import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { DataSource } from 'typeorm';
import { env } from '../config/env';
import { User } from '../entities/user.entity';
import { UnauthorizedError } from '../errors/http-error';

export interface LoginResult {
  accessToken: string;
  user: { id: string; email: string };
}

export async function login(
  dataSource: DataSource,
  email: string,
  password: string,
): Promise<LoginResult> {
  const users = dataSource.getRepository(User);
  const user = await users.findOne({ where: { email } });

  // Error for mismatch
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const accessToken = jwt.sign(
    { sub: user.id, email: user.email },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    },
  );

  return { accessToken, user: { id: user.id, email: user.email } };
}
