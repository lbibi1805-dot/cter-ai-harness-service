---
title: "clock_getres()"
category: "Clock-and-timer-services"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, clock, timer]
---

# clock_getres()
_Get the resolution of the clock_

## Synopsis:

```c
#include <time.h>

int clock_getres( clockid_t clock_id, 
                  struct timespec * res );
```

## Arguments:

**clock_id** —

The ID of the clock whose resolution you want to get; one of:

- CLOCK_REALTIME — the standard POSIX-defined clock. Timers based on this clock wake up the processor if it's in a power-saving mode.
- CLOCK_SOFTTIME — (a QNX Neutrino extension) this clock is active only when the processor _isn't_ in a power-saving mode. For example, an application using a CLOCK_SOFTTIME timer to sleep wouldn't wake up the processor when the application was due to wake up. This will allow the processor to enter a power-saving mode.

    While the processor isn't in a power-saving mode, CLOCK_SOFTTIME behaves the same as CLOCK_REALTIME.

- CLOCK_MONOTONIC — this clock always increases at a constant rate and can't be adjusted.

For more information about the different clocks, see “[Other clock sources](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_timer_otherclock.html)” in the Clocks, Timers, and Getting a Kick Every So Often of Getting Started with QNX Neutrino.

**res** —

A pointer to a [timespec](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timespec.html "Time-specification structure") structure in which clock_getres() can store the resolution. The function sets the tv_sec member to 0, and the tv_nsec member to be the resolution of the clock, in nanoseconds.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The clock_getres() function gets the resolution of the clock specified by clock_id and puts it into the buffer pointed to by res.

## Returns:

0

Success.

-1

An error occurred ([errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") is set).

## Errors:

### `EFAULT`

A fault occurred trying to access the buffers provided.

### `EINVAL`

Invalid clock_id.

## Examples:

```c
/*
 * This program prints out the clock resolution.
 */
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

int main( void )
  {
    struct timespec res;

    if ( clock_getres( CLOCK_REALTIME, &res) == -1 ) {
      perror( "clock get resolution" );
      return EXIT_FAILURE;
    }
    printf( "Resolution is %ld micro seconds.\n",
          res.tv_nsec / 1000 );
    return EXIT_SUCCESS;
  }
```

## Classification:

[POSIX 1003.1](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

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

### Related reference  

[clock_gettime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_gettime.html "Get the current time of a clock")

[clock_settime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_settime.html "Set a clock")

[ClockPeriod(), ClockPeriod_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockperiod.html "Get or set a clock period")

[timespec](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timespec.html "Time-specification structure")
