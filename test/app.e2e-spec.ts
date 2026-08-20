import request from 'supertest';
import { app } from '../src/app';

// A real HTTP test against the actual Express app (via supertest), not a
// mocked framework module — this is what "e2e" means once there's no
// NestJS TestingModule to spin up. GET / doesn't touch the database, so
// this runs without a live Postgres connection; anything that does touch
// the database is exercised live in the README's curl walkthrough instead.
describe('App (e2e)', () => {
  it('GET / reports service status', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      service: 'fitring-companion-backend',
      status: 'ok',
    });
  });

  it('a protected route without a token is rejected', async () => {
    const response = await request(app).get('/devices');

    expect(response.status).toBe(401);
  });
});
