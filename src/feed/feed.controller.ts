import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/current-user.interface';
import { Public } from '../common/auth/public.decorator';
import type { FeedQueryDto } from './dto/feed-query.dto';
import type { FeedService } from './feed.service';

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get('home')
  @Public()
  getHomeFeed(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: FeedQueryDto,
  ) {
    return this.feedService.getHomeFeed(user?.id, query);
  }

  @Get('profile/:userId')
  @Public()
  getProfileFeed(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: FeedQueryDto,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.feedService.getProfileFeed(user?.id, userId, query);
  }

  @Get('company/:companyId')
  @Public()
  getCompanyFeed(
    @CurrentUser() _user: AuthenticatedUser | undefined,
    @Query() query: FeedQueryDto,
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.feedService.getCompanyFeed(companyId, query);
  }

  @Get('hashtag/:tag')
  @Public()
  getHashtagFeed(
    @CurrentUser() _user: AuthenticatedUser | undefined,
    @Query() query: FeedQueryDto,
    @Param('tag') tag: string,
  ) {
    return this.feedService.getHashtagFeed(tag, query);
  }
}
