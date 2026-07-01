import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';

import { TenantContextInterceptor } from '../tenant-context.interceptor';
import { TenantContext } from '../tenant-context';

describe('TenantContextInterceptor', () => {
  it('initializes TenantContext from the authenticated user', (done) => {
    const interceptor = new TenantContextInterceptor();
    const next: CallHandler = {
      handle: () => {
        expect(TenantContext.get()).toEqual({
          groupementId: 'c0f8bf75-b9a7-4adc-a702-9c43fbf0f015',
          userId: 'c7f9c0f7-e128-4ee3-91d5-ed02e78e0c2c',
        });
        return of('ok');
      },
    };

    interceptor
      .intercept(
        createExecutionContext({
          groupementId: 'c0f8bf75-b9a7-4adc-a702-9c43fbf0f015',
          id: 'c7f9c0f7-e128-4ee3-91d5-ed02e78e0c2c',
        }),
        next,
      )
      .subscribe({
        complete: done,
        error: done,
      });
  });

  it('passes through public requests without tenant context', (done) => {
    const interceptor = new TenantContextInterceptor();
    const next: CallHandler = {
      handle: () => {
        expect(TenantContext.getOrNull()).toBeNull();
        return of('ok');
      },
    };

    interceptor.intercept(createExecutionContext(undefined), next).subscribe({
      complete: done,
      error: done,
    });
  });
});

function createExecutionContext(user?: { id: string; groupementId: string }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}
