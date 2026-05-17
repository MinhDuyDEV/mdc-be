<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-16 | Updated: 2026-05-16 -->

# src/common/validation

## Purpose

Validation pipe factory and default options for NestJS. Provides a factory function to create validation pipes with sensible defaults (transform, whitelist, forbid non-whitelisted, validate custom decorators). Used globally in `bootstrap.ts` to validate all incoming request data.

## Key Files

| File | Description |
|------|-------------|
| `validation-pipe.factory.ts` | `createValidationPipe()` factory function; `defaultValidationPipeOptions` with sensible defaults; custom exception factory for validation errors |
| `index.ts` | Barrel export: re-exports all public APIs |

## For AI Agents

### Working In This Directory

- **Validation pipe**: `createValidationPipe()` returns a NestJS `ValidationPipe` with default options. Call it in `bootstrap.ts` to create the global validation pipe.
- **Default options**: `defaultValidationPipeOptions` includes:
  - `transform: true` — transforms input to DTO class instances
  - `whitelist: true` — removes properties not defined in the DTO
  - `forbidNonWhitelisted: true` — throws error if extra properties are present
  - `validateCustomDecorators: true` — validates custom decorators on DTO properties
- **Custom exception factory**: The pipe uses a custom `exceptionFactory` that formats validation errors into a `BadRequestException` with code `VALIDATION_ERROR` and detailed error information.
- **Error format**: Validation errors are formatted as:
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Validation failed",
      "details": [
        {
          "property": "email",
          "constraints": {
            "isEmail": "email must be an email"
          }
        }
      ]
    }
  }
  ```
- **Customization**: Pass options to `createValidationPipe()` to override defaults:
  ```typescript
  createValidationPipe({ forbidNonWhitelisted: false })
  ```

### Testing Requirements

- **Unit tests**: Test `createValidationPipe()` with valid and invalid DTOs, extra properties, missing required fields.
- **Test coverage**: Verify pipe transforms input, whitelists properties, forbids non-whitelisted, validates custom decorators, and formats errors correctly.
- **Run tests**: `npm test -- src/common/validation`
- **Coverage target**: Aim for >80% on new code.

### Common Patterns

- **Creating the global pipe**: In `bootstrap.ts`, create and use the validation pipe:
  ```typescript
  app.useGlobalPipes(createValidationPipe());
  ```
- **Customizing options**: Override specific options:
  ```typescript
  app.useGlobalPipes(
    createValidationPipe({
      skipMissingProperties: true
    })
  );
  ```
- **DTO with validation**: Use `class-validator` decorators on DTO properties:
  ```typescript
  export class CreateUserDto {
    @IsEmail()
    email: string;

    @IsString()
    @MinLength(8)
    password: string;

    @IsOptional()
    @IsString()
    name?: string;
  }
  ```
- **Custom validators**: Use `class-validator` custom decorators for complex validation:
  ```typescript
  export class CreateUserDto {
    @IsEmail()
    email: string;

    @Validate(IsStrongPasswordConstraint)
    password: string;
  }
  ```
- **Conditional validation**: Use `@ValidateIf()` for conditional validation:
  ```typescript
  export class UpdateUserDto {
    @IsOptional()
    @IsString()
    name?: string;

    @ValidateIf((o) => o.role === 'admin')
    @IsString()
    adminNotes?: string;
  }
  ```

## Dependencies

### Internal

- **errors/**: Validation errors are caught by `ApiExceptionFilter` and formatted into the error envelope.

### External

- **@nestjs/common**: `ValidationPipe`, `BadRequestException`, `ValidationPipeOptions`.
- **class-validator**: `ValidationError`.
