import { getServerAndReactClient } from './__reactHelpers';
import { InfiniteData } from '@tanstack/react-query';
import { createServerSideHelpers } from '@trpc/react-query/server';
import { initTRPC } from '@trpc/server/src';
import { konn } from 'konn';
import SuperJSON from 'superjson';
import { z } from 'zod';

const ctx = konn()
  .beforeEach(() => {
    const t = initTRPC.create();

    const appRouter = t.router({
      post: t.router({
        byId: t.procedure
          .input(
            z.object({
              id: z.string(),
            }),
          )
          .query(() => '__result' as const),
        list: t.procedure
          .input(
            z.object({
              cursor: z.string().optional(),
            }),
          )
          .query(() => '__infResult' as const),
        throwsError: t.procedure.query(() => {
          throw new Error('__error');
        }),
      }),
    });

    return getServerAndReactClient(appRouter);
  })
  .afterEach(async (ctx) => {
    await ctx?.close?.();
  })
  .done();

test('fetch', async () => {
  const { opts } = ctx;
  const ssg = createServerSideHelpers({
    client: opts.proxy,
  });

  const post = await ssg.post.byId.fetch({ id: '1' });
  expectTypeOf<'__result'>(post);
});

test('fetchInfinite', async () => {
  const { opts } = ctx;
  const ssg = createServerSideHelpers({
    client: opts.proxy,
  });

  const post = await ssg.post.list.fetchInfinite({});
  expectTypeOf<InfiniteData<'__infResult'>>(post);

  expect(post.pages).toStrictEqual(['__infResult']);
});

test('prefetch and dehydrate', async () => {
  const { opts } = ctx;
  const ssg = createServerSideHelpers({
    client: opts.proxy,
  });
  await ssg.post.byId.prefetch({ id: '1' });

  const data = JSON.stringify(ssg.dehydrate());
  expect(data).toContain('__result');
});

test('prefetchInfinite and dehydrate', async () => {
  const { opts } = ctx;
  const ssg = createServerSideHelpers({
    client: opts.proxy,
  });
  await ssg.post.list.prefetchInfinite({});

  const data = JSON.stringify(ssg.dehydrate());
  expect(data).toContain('__infResult');
});

test('prefetch faulty query and dehydrate', async () => {
  const { opts } = ctx;
  const ssg = createServerSideHelpers({
    client: opts.proxy,
    transformer: SuperJSON,
  });

  await ssg.post.throwsError.prefetch();

  const data = JSON.stringify(ssg.dehydrate());
  expect(data).toContain('__error');
});
