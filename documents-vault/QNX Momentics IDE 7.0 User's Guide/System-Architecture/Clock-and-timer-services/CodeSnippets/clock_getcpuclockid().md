---
title: "clock_getcpuclockid()"
category: "Clock-and-timer-services"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, clock, timer]
---

# clock_getcpuclockid()
_Return the clock ID of the CPU-time clock from a specified process_

## Synopsis:

```c
#include <sys/types.h>
#include <time.h>
#include <errno.h>

int clock_getcpuclockid( pid_t pid,
                         clockid_t* clock_id );
```

## Arguments:

**pid** —

The process ID for the process whose clock ID you want to get.

**clock_id** —

A pointer to a clockid_t object where the function can store the clock ID.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The clock_getcpuclockid() function gets the clock ID of the CPU-time clock of the process specified by pid and stores it in the object pointed to by clock_id. The CPU-time clock represents the amount of time the process has spent running, which is the sum of the running time of its threads. For more information, see “[Monitoring execution times](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/timing_execution_times.html)” in the “Understanding the Microkernel's Concept of Time” chapter of the QNX Neutrino Programmer's Guide.

If pid is zero, the clock ID of the CPU-time clock of the process marking the call is returned in clock_id.

A process always has permission to obtain the CPU-time clock ID of another process.

## Returns:

0

Success.

### `ESRCH`

No process can be found corresponding to the specified pid.

## Examples:

```c
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <errno.h>

int main( int argc, const char *argv[] )
{
    clockid_t clk_id;
    struct timespec tspec;
    int pid;

    /* Get the amount of time that the kernel has spent running. */

    pid = 1;

    if (clock_getcpuclockid( pid, &clk_id) == 0)
    {
        if (clock_gettime( clk_id, &tspec ) != 0)
        {
            perror ("clock_gettime():");
        }
        else
        {
            printf ("CPU time for pid %d is %d seconds, %ld nanoseconds.\n",
                    pid, tspec.tv_sec, tspec.tv_nsec);
        }
    }
    else
    {
        printf ("clock_getcpuclockid(): no process with ID %d.\n", pid);
    }

    return EXIT_SUCCESS;
}
```

## Classification:

[POSIX 1003.1 CPT](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

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

[clock_getres()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_getres.html "Get the resolution of the clock")

[clock_gettime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_gettime.html "Get the current time of a clock")

[ClockId(), ClockId_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockid.html "Get the CPU-time clock ID for a given process and thread")

[clock_settime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_settime.html "Set a clock")

[pthread_getcpuclockid()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_getcpuclockid.html "Return the clock ID of the CPU-time clock from a specified thread")

[timer_create()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timer_create.html "Create a timer")
