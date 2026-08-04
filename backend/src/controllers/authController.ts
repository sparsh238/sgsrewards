import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import User from '../models/userModel';

// HS256 signing key. jose replaces jsonwebtoken (whose dependency chain broke
// on Node >= 24 via the long-dead buffer-equal-constant-time package). Tokens
// remain standard HS256 JWTs, so sessions issued before the switch stay valid.
const jwtSecret = () => new TextEncoder().encode(process.env.JWT_SECRET!);

const signAccessToken = (user: { _id: unknown; userType: string }) =>
  new SignJWT({ _id: String(user._id), userType: user.userType })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRATION || '30d')
    .sign(jwtSecret());

const signRefreshToken = (user: { _id: unknown }) =>
  new SignJWT({ _id: String(user._id) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_REFRESH_EXPIRATION || '45d')
    .sign(jwtSecret());

// Dealers authenticate with a 4-digit PIN (stored bcrypt-hashed in `password`).
export const isValidPin = (v: unknown): v is string => typeof v === 'string' && /^\d{4}$/.test(v);

const register = async (req: Request, res: Response) => {
    const { username, partyName, phoneNumber, password } = req.body;
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(403).json({ message: 'Forbidden: Invalid API key' });
  }

    if (typeof username !== 'string' || typeof phoneNumber !== 'string' ||
        typeof password !== 'string' || typeof partyName !== 'string') {
      return res.status(400).json({ message: 'All fields are required' });
    }

    try {
      const existingUser = await User.findOne({ phoneNumber });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 8);
      // Self-registration always creates a plain customer. Elevated roles are
      // provisioned only through the superadmin add-user flow.
      const user = new User({ username, partyName, phoneNumber, password: hashedPassword, userType: 'customer' });
      await user.save();
  
      const token = await signAccessToken(user);
      const refreshToken = await signRefreshToken(user);
      user.refreshToken = refreshToken;
      await user.save();

      res.status(201).json({ user, token, refreshToken });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error', error });
    }
  };

const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).send({ error: 'Invalid username or password' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).send({ error: 'User not found' });
    }

    if (user.blocked) {
        return res.status(403).json({ message: 'User is blocked' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).send({ error: 'Invalid username or password' });
    }

    const token = await signAccessToken(user);
    const refreshToken = await signRefreshToken(user);
    user.refreshToken = refreshToken;
    await user.save();

    res.send({ user, token, refreshToken });
  } catch (error) {
    res.status(500).send(error);
  }
};

// Dealer login: phone number + 4-digit PIN. Customers only (staff use /login).
const loginWithPin = async (req: Request, res: Response) => {
  const { phoneNumber, pin } = req.body;

  if (typeof phoneNumber !== 'string' || !isValidPin(pin)) {
    return res.status(400).send({ error: 'Enter your phone number and 4-digit PIN' });
  }

  try {
    const user = await User.findOne({ phoneNumber, userType: 'customer' });
    // Same generic message whether the number or PIN is wrong (no account enumeration).
    if (!user) {
      return res.status(400).send({ error: 'Invalid phone number or PIN' });
    }
    if (user.blocked) {
      return res.status(403).json({ message: 'User is blocked' });
    }

    const isMatch = await bcrypt.compare(pin, user.password);
    if (!isMatch) {
      return res.status(400).send({ error: 'Invalid phone number or PIN' });
    }

    const token = await signAccessToken(user);
    const refreshToken = await signRefreshToken(user);
    user.refreshToken = refreshToken;
    await user.save();

    res.send({ user, token, refreshToken });
  } catch (error) {
    res.status(500).send({ error: 'Login failed' });
  }
};

const refreshToken = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (typeof refreshToken !== 'string') {
    return res.status(400).send({ error: 'Refresh token is required' });
  }

  try {
    const { payload } = await jwtVerify(refreshToken, jwtSecret(), { algorithms: ['HS256'] });
    const decoded = payload as { _id: string };
    const user = await User.findOne({ _id: decoded._id, refreshToken });

    if (!user) {
      return res.status(403).send({ error: 'Access denied' });
    }

    const newToken = await signAccessToken(user);
    const newRefreshToken = await signRefreshToken(user);
    user.refreshToken = newRefreshToken;
    await user.save();

    res.send({ token: newToken, refreshToken: newRefreshToken });
  } catch (error) {
    // Expired/invalid token (jwtVerify throws) or unexpected failure.
    res.status(403).send({ error: 'Invalid or expired refresh token' });
  }
};

const logout = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (typeof refreshToken !== 'string') {
    return res.status(400).send({ error: 'Refresh token is required' });
  }

  try {
    const user = await User.findOneAndUpdate({ refreshToken }, { refreshToken: null });

    if (!user) {
      return res.status(404).send({ error: 'User not found' });
    }

    res.send({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).send(error);
  }
};

export { register, login, loginWithPin, refreshToken, logout };
