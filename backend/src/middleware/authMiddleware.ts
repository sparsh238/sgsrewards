import { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';
import User from '../models/userModel';

type UserRole = 'customer' | 'admin' | 'superadmin';

const authMiddleware = (...requiredRoles: UserRole[]) => async (req: Request, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).send({ error: 'Please authenticate' });
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET!), { algorithms: ['HS256'] });
    const decoded = payload as { _id: string; userType?: string };
    // Authenticate by the token's subject alone. We deliberately no longer require
    // the bearer to equal the stored `refreshToken` field: that field rotates on
    // every login, so the old check silently invalidated a user's other sessions
    // (and any token refresh) — the source of the random logouts. The bearer is a
    // signed, unexpired JWT, which is sufficient. A blocked user is rejected here
    // so a block takes effect on their very next request.
    const user = await User.findById(decoded._id);

    if (!user || user.blocked) {
      throw new Error();
    }

    req.user = user;

    if (requiredRoles.length && !requiredRoles.includes(user.userType as UserRole)) {
      return res.status(403).send({ error: 'Access denied' });
    }

    next();
  } catch (error) {
    res.status(401).send({ error: 'Please authenticate' });
  }
};

export default authMiddleware;
