import { InvalidTaskStateTransitionException } from './invalid-task-state-transition.exception';
import { TaskNotFoundException } from './task-not-found.exception';
import { HousekeeperNotFoundException } from './housekeeper-not-found.exception';
import { TaskStatus } from '@prisma/client';
import { HttpStatus } from '@nestjs/common';

describe('Housekeeping domain exceptions', () => {
  describe('TaskNotFoundException', () => {
    it('sets correct HTTP status and error code', () => {
      const ex = new TaskNotFoundException('task-abc');

      expect(ex.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(ex.code).toBe('TASK_NOT_FOUND');
      expect(ex.message).toContain('task-abc');
    });
  });

  describe('HousekeeperNotFoundException', () => {
    it('sets correct HTTP status and error code', () => {
      const ex = new HousekeeperNotFoundException('user-xyz');

      expect(ex.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(ex.code).toBe('HOUSEKEEPER_NOT_FOUND');
      expect(ex.message).toContain('user-xyz');
    });
  });

  describe('InvalidTaskStateTransitionException', () => {
    it('includes both statuses in the detail message', () => {
      const ex = new InvalidTaskStateTransitionException(TaskStatus.COMPLETED, TaskStatus.PENDING);

      expect(ex.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(ex.code).toBe('INVALID_TASK_STATE_TRANSITION');
      expect(ex.message).toContain('COMPLETED');
      expect(ex.message).toContain('PENDING');
    });

    it('trims trailing whitespace when no reason is provided', () => {
      const ex = new InvalidTaskStateTransitionException(TaskStatus.CANCELLED, TaskStatus.ASSIGNED);

      // Message should not end with a trailing space
      expect(ex.message).not.toMatch(/ $/);
    });

    it('includes reason when provided', () => {
      const ex = new InvalidTaskStateTransitionException(
        TaskStatus.COMPLETED,
        TaskStatus.PENDING,
        'Cannot reopen completed tasks',
      );

      expect(ex.message).toContain('Cannot reopen completed tasks');
    });
  });
});
