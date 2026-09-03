---
title: "ClockId(), ClockId_r()"
category: "Clock-and-timer-services"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, clock, timer]
---

# ClockId(), ClockId_r()

_Get the CPU-time clock ID for a given process and thread_

## Synopsis:

```c
#include <sys/neutrino.h>
#include <inttypes.h>

int ClockId( pid_t pid, 
             int tid ); 

int ClockId_r( pid_t pid, 
               int tid );
```

## Arguments:

**pid** —

The ID of the process that you want to get the clock ID for. If this argument is zero, the ID of the process making the call is assumed.

**tid** —

The ID of the thread that you want to get the clock ID for, or 0 to get the clock ID for the process as a whole.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The ClockId() and ClockId_r() kernel calls retrieve the clock ID of a process or thread CPU-time clock. These clocks represent the amount of time the process or thread has spent running. See “[Monitoring execution times](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/timing_execution_times.html)” in the “Understanding the Microkernel's Concept of Time” chapter of the QNX Neutrino Programmer's Guide.

The ClockId() and ClockId_r() functions are identical except in the way they indicate errors. See the [Returns](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockid.html#clockid__Returns) section for details.

Instead of using these kernel calls directly, consider calling [clock_getcpuclockid()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_getcpuclockid.html "Return the clock ID of the CPU-time clock from a specified process") or [pthread_getcpuclockid()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_getcpuclockid.html "Return the clock ID of the CPU-time clock from a specified thread").

**Blocking states:**

These calls don't block.

## Returns:

A clock ID for a process or thread CPU-time clock. If an error occurs:

- ClockId() returns -1 and sets [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable").
- ClockId_r() returns the negative of a value from the Errors section and **doesn't** set errno.

## Errors:

### `ESRCH`

The pid and/or tid don't exist.

## Examples:

Here's how you can determine how busy a system is:

id = ClockId(1, 1);
for( ;; ) {
    ClockTime(id, NULL, &start);
    sleep(1);
    ClockTime(id, NULL, &stop);
    printf("load = %f%%\n", (1000000000.0 - (stop - start)) / 10000000.0);
}

## Classification:

[QNX Neutrino](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|No|
> |Interrupt handler|No|
> |Signal handler|Yes|
> |Thread|Yes|

### Related concepts  

[Clocks, Timers, and Getting a Kick Every So Often (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_timer.html "Clocks, Timers, and Getting a Kick Every So Often (Getting Started with QNX Neutrino)")

[Monitoring execution times (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/timing_execution_times.html "Monitoring execution times (Getting Started with QNX Neutrino)")

### Related reference  

[clock_getcpuclockid()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_getcpuclockid.html "Return the clock ID of the CPU-time clock from a specified process")

[clock_gettime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_gettime.html "Get the current time of a clock")

[ClockTime(), ClockTime_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clocktime.html "Get or set a clock")

[pthread_getcpuclockid()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_getcpuclockid.html "Return the clock ID of the CPU-time clock from a specified thread")
