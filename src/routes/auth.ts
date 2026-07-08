import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { User } from "../models";

export const authRouter = Router();

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});


authRouter.post("/register", async (req, res) => {
  const parsed = CredentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid email or password (min 8 characters)" });
  }

  const existing = await User.findOne({ email: parsed.data.email });
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await User.create({ email: parsed.data.email, passwordHash });
  res.status(201).json({ id: user._id, email: user.email });
});

authRouter.post("/login", async (req, res) => {
  const parsed = CredentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid email or password" });
  }

  const user = await User.findOne({ email: parsed.data.email });
  if (!user?.passwordHash) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  res.json({ id: user._id, email: user.email, name: user.name });
});
