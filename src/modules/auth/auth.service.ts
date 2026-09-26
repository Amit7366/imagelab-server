import { ROLES } from "../../constants/roles";
import { ApiError } from "../../utils/ApiError";
import { createRefreshToken, hashToken, signAccessToken } from "../../utils/token";
import { User } from "../user/user.model";
import { toPublicUser, type PublicUser } from "../user/user.service";

interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

async function issueTokens(userId: string): Promise<AuthResult> {
  const user = await User.findById(userId).select("+refreshTokenHash");
  if (!user) throw new ApiError(404, "User not found");

  const refreshToken = createRefreshToken();
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();

  return {
    user: toPublicUser(user),
    accessToken: signAccessToken({ sub: user.id, email: user.email, role: user.role }),
    refreshToken,
  };
}

export const authService = {
  async register(input: { name: string; email: string; password: string }) {
    const existing = await User.findOne({ email: input.email });
    if (existing) throw new ApiError(409, "Email is already registered");

    const user = await User.create({ ...input, role: ROLES.USER });
    return issueTokens(user.id);
  },

  async login(input: { email: string; password: string }) {
    const user = await User.findOne({ email: input.email }).select("+password");
    if (!user || !(await user.comparePassword(input.password))) {
      throw new ApiError(401, "Invalid email or password");
    }
    if (!user.isActive) throw new ApiError(403, "This account is inactive");
    return issueTokens(user.id);
  },

  async refresh(refreshToken: string) {
    const user = await User.findOne({ refreshTokenHash: hashToken(refreshToken) }).select("+refreshTokenHash");
    if (!user) throw new ApiError(401, "Invalid refresh token");
    if (!user.isActive) throw new ApiError(403, "This account is inactive");
    return issueTokens(user.id);
  },

  async logout(refreshToken: string) {
    await User.updateOne({ refreshTokenHash: hashToken(refreshToken) }, { $unset: { refreshTokenHash: 1 } });
  },

  async me(userId: string) {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");
    return toPublicUser(user);
  },
};
