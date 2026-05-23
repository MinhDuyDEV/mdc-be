<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-23T10:00:00Z | Updated: 2026-05-23T10:00:00Z -->

# Recommendations DTOs

## Purpose
Data transfer objects for recommendation queries and responses. Validates parameters for personalized content recommendations.

## Key Files
| File | Description |
|------|-------------|
| recommendations-query.dto.ts | Query parameters for recommendation requests (type, limit, filters) |
| recommendations-response.dto.ts | Response structure for recommendation results with scores and metadata |
| index.ts | Barrel export for all recommendation DTOs |

## For AI Agents

### Working In This Directory
- Query DTOs specify recommendation type (jobs, connections, content, companies)
- Limit parameter controls number of recommendations (default 10, max 50)
- Filters include location, industry, skills, experience level
- Response DTOs include recommendation score (0-1) and explanation
- Recommendations are personalized based on user profile and activity

### Testing Requirements
- Test query validation with various recommendation types
- Test limit boundaries (negative, zero, max exceeded)
- Test filter combinations (multiple filters, invalid values)
- Verify response includes scores and explanations
- Test recommendation diversity (not all same type)
- Run tests: `npm test -- src/recommendations`

### Common Patterns
- Query DTO: `@IsEnum(RecommendationType) type: RecommendationType; @IsInt() @Min(1) @Max(50) limit?: number`
- Filters: `@IsOptional() @IsArray() @IsString({ each: true }) skills?: string[]`
- Response DTO: `{ items: T[]; scores: number[]; explanations: string[] }`
- Score range: `@IsNumber() @Min(0) @Max(1) score: number`

## Dependencies

### Internal
- Used by `RecommendationsController` for request/response validation
- Used by `RecommendationsService` for recommendation generation
- Integrates with `RecommendationsRepository` for data access
- May use ML models for personalization

### External
- `class-validator` — Decorator-based validation
- `class-transformer` — Type transformation
- `@nestjs/common` — NestJS framework integration

<!-- MANUAL: -->
