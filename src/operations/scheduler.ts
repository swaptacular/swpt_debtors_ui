import TinyQueue from 'tinyqueue'

const SCHEDULER_LEEWAY = 0.5

type Task = {
  notBefore: Date,
  notAfter: Date,
}

export class UpdateScheduler {
  private lastCheckAt: number = Date.now()
  private tasks = new TinyQueue<Task>([], (a, b) => a.notBefore.getTime() - b.notBefore.getTime())
  private readyTasks = new TinyQueue<Task>([], (a, b) => a.notAfter.getTime() - b.notAfter.getTime())

  constructor() {
    // TODO: Periodically call `checkTasks()`.
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
  }

  private checkTasks(): void {
    this.lastCheckAt = Date.now()
    this.collectReadyTasks()
    if (this.findLateTasks()) {
      // TODO: perform update
    }
  }

  private collectReadyTasks(): void {
    const now = this.lastCheckAt
    let task
    while ((task = this.tasks.pop()) !== undefined) {
      if (now < task.notBefore.getTime()) {
        // This task is not ready, and therefore all subsequent tasks
        // in the queue will not be ready too.
        this.tasks.push(task)
        break
      }
      this.readyTasks.push(task)
    }
  }

  private findLateTasks(): boolean {
    const now = this.lastCheckAt
    let found = false
    let task
    while ((task = this.readyTasks.pop()) !== undefined) {
      if (now < task.notAfter.getTime()) {
        // This task can be postponed, and therefore all subsequent tasks
        // in the queue can be postponed too.
        this.readyTasks.push(task)
        break
      }
      found = true
    }
    return found
  }
}
