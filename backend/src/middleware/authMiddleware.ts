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
    const user = await User.findOne({ _id: decoded._id, refreshToken: token });

    if (!user) {
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
