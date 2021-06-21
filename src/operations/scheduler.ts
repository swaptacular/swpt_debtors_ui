import TinyQueue from 'tinyqueue'

const SCHEDULER_LEEWAY = 0.5
// For example, when `SCHEDULER_LEEWAY` is 0.5, and an update is
// scheduled one hour from now, the update will actually happen
// between one and one and a half hours from now.

const SCHEDULER_CHECK_INTERVAL_SECONDS = 5

type Task = {
  notBefore: Date,
  notAfter: Date,
}

export class UpdateScheduler {
  private tasks = new TinyQueue<Task>([], (a, b) => a.notBefore.getTime() - b.notBefore.getTime())
  private readyTasks!: TinyQueue<Task>
  private intervalId?: number

  constructor() {
    this.clearReadyTasks()
    this.intervalId = setInterval(this.checkTasks.bind(this), 1000 * SCHEDULER_CHECK_INTERVAL_SECONDS)
  }

  add(): void
  add(date: Date): void
  add(seconds: number): void
  add(when: Date | number = 0): void {
    const now = Date.now()
    const t = Math.max(now, typeof when === 'number' ? now + 1000 * when : when.getTime())
    const notBefore = new Date(t)
    const notAfter = new Date(t + (t - now) * SCHEDULER_LEEWAY)
    this.tasks.push({ notBefore, notAfter })
    this.checkTasks()
  }

  close(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId)
      this.tasks = undefined as any as TinyQueue<Task>
      this.intervalId = undefined
    }
  }

  private checkTasks(): void {
    this.collectReadyTasks()
    if (this.findLateTask()) {
      this.clearReadyTasks()

      // TODO: perform update
    }
  }

  private clearReadyTasks(): void {
    this.readyTasks = new TinyQueue<Task>([], (a, b) => a.notAfter.getTime() - b.notAfter.getTime())
  }

  private collectReadyTasks(): void {
    const now = Date.now()
    let task
    while ((task = this.tasks.peek()) !== undefined) {
      if (now < task.notBefore.getTime()) {
        // This task is not ready, and therefore all subsequent tasks
        // in the queue will not be ready too.
        break
      }
      this.tasks.pop()
      this.readyTasks.push(task)
    }
  }

  private findLateTask(): boolean {
    const now = Date.now()
    const task = this.readyTasks.peek()
    return Boolean(task && task.notAfter.getTime() <= now)
  }
}
