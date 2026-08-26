import { HttpStatus } from '@nestjs/common';
import { RoomManagerException } from '../base.exception';

export class TaskNotFoundException extends RoomManagerException {
  constructor(taskId: string) {
    super(
      {
        code: 'TASK_NOT_FOUND',
        detail: `Housekeeping task with identifier '${taskId}' was not found.`,
        context: { taskId },
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
