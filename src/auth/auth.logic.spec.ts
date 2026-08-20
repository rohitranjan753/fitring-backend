import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { DataSource, Repository } from 'typeorm';
import { UnauthorizedError } from '../errors/http-error';
import { User } from '../entities/user.entity';
import { login } from './auth.logic';

interface MockUsersRepo {
  findOne: jest.Mock;
}

function fakeDataSource(users: MockUsersRepo): DataSource {
  return {
    getRepository: () => users as unknown as Repository<User>,
  } as unknown as DataSource;
}

describe('auth.logic login', () => {
  let users: MockUsersRepo;

  beforeEach(() => {
    users = { findOne: jest.fn() };
  });

  it('rejects when no user exists for the email', async () => {
    users.findOne.mockResolvedValue(null);

    await expect(
      login(fakeDataSource(users), 'nobody@fitring.app', 'whatever'),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('rejects on a wrong password with the same message as "no such user" — never reveals which was wrong', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 10);
    users.findOne.mockResolvedValue({
      id: 'u1',
      email: 'demo@fitring.app',
      passwordHash,
    });

    await expect(
      login(fakeDataSource(users), 'demo@fitring.app', 'wrong-password'),
    ).rejects.toThrow('Invalid email or password');
  });

  it('returns a validly signed token and the right user info on correct credentials', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 10);
    users.findOne.mockResolvedValue({
      id: 'u1',
      email: 'demo@fitring.app',
      passwordHash,
    });

    const result = await login(
      fakeDataSource(users),
      'demo@fitring.app',
      'correct-password',
    );

    expect(result.user).toEqual({ id: 'u1', email: 'demo@fitring.app' });
    const decoded = jwt.decode(result.accessToken) as {
      sub: string;
      email: string;
    };
    expect(decoded.sub).toBe('u1');
    expect(decoded.email).toBe('demo@fitring.app');
  });
});
