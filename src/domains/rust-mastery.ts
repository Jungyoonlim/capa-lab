import { DomainConfig } from '@/lib/types';

export const rustMastery: DomainConfig = {
  id: 'rust-mastery',
  name: 'Rust Mastery',
  description: 'Rust ownership, type system, and systems patterns',
  layers: [
    {
      id: 'rust-ownership',
      name: 'Rust Ownership & Type System',
      description: 'Ownership, borrowing, lifetimes, type system, trait system, generics',
      order: 1,
      domain: 'rust-mastery',
    },
    {
      id: 'rust-systems',
      name: 'Rust Systems Patterns',
      description: 'Async runtime, concurrency primitives, state machines, error handling patterns',
      order: 2,
      domain: 'rust-mastery',
    },
  ],
};
