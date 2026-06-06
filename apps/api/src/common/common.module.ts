import { Global, Module } from '@nestjs/common';
import { AuthContextCacheService } from './auth-context-cache.service';
import { HierarchyService } from './hierarchy.service';

@Global()
@Module({
  providers: [AuthContextCacheService, HierarchyService],
  exports: [AuthContextCacheService, HierarchyService],
})
export class CommonModule {}
