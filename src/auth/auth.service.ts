import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../infra/prisma/prisma.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

interface RegisterDto {
  email: string;
  password: string;
}

interface LoginDto {
  email: string;
  password: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
      },
    });

    // Generate verification token (TBD: send via email in later task)
    try {
      await this.emailVerificationService.generateToken(user.id);
    } catch (error) {
      this.logger.error(
        `Failed to generate verification token for user ${user.id}`,
        error,
      );
    }

    this.logger.log(`User registered: ${user.id}`);

    return {
      id: user.id,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt,
      status: user.status,
      createdAt: user.createdAt,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValid = await this.passwordService.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.tokenService.generateAccessToken(
      user.id,
      user.email,
    );
    const { token: refreshToken } =
      await this.tokenService.generateRefreshToken(user.id);

    this.logger.log(`User logged in: ${user.id}`);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    };
  }
}
