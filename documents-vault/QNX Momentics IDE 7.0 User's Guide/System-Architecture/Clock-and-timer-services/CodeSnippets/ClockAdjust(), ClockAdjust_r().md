---
title: "ClockAdjust(), ClockAdjust_r()"
category: "Clock-and-timer-services"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, clock, timer]
---

# ClockAdjust(), ClockAdjust_r()

_Adjust the time of a clock_

## Synopsis:

```c
#include <sys/neutrino.h>

int ClockAdjust( clockid_t id,
                 const struct _clockadjust * new,
                 struct _clockadjust * old );

int ClockAdjust_r( clockid_t id,
                   const struct _clockadjust * new,
                   struct _clockadjust * old );
```

## Arguments:

**id** —

The ID of the clock you want to adjust. This must be CLOCK_REALTIME; this clock maintains the system time.

**new** —

NULL or a pointer to a _clockadjust structure that specifies how to adjust the clock. Any previous adjustment is replaced.

The _clockadjust structure contains at least the following members:

- long tick_nsec_inc — the adjustment to be made on each clock tick, in nanoseconds.
- unsigned long tick_count — the number of clock ticks over which to apply the adjustment.

**old** —

If not NULL, a pointer to a _clockadjust structure where the function can store the current adjustment (before being changed by a non-NULL new).

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

These kernel calls let you gradually adjust the time of the clock specified by id. You can use these functions to speed up or slow down the system clock to synchronize it with another time source–without causing major discontinuities in the time flow.

The ClockAdjust() and ClockAdjust_r() functions are identical except in the way they indicate errors. See the [Returns](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockadjust.html#clockadjust__Returns) section for details.

The total time adjustment, in nanoseconds, is:

(new->tick_count * new->tick_nsec_inc)

If the current clock is ahead of the desired time, you can specify a negative tick_nsec_inc to slow down the clock. This is preferable to setting the time backwards with the [ClockTime()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clocktime.html "Get or set a clock") kernel call, since some programs may malfunction if time goes backwards.

Picking small values for tick_nsec_inc and large values for tick_count adjusts the time slowly, while the opposite approach adjusts it rapidly. As a rule of thumb, don't try to set a tick_nsec_inc that exceeds the basic clock tick as set by the [ClockPeriod()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockperiod.html "Get or set a clock period") kernel call. This would change the clock rate by more than 100% and if the adjustment is negative, it could make the clock go backwards.

You can cancel any adjustment in progress by setting tick_count and tick_nsec_inc to 0.

In order to adjust the clock, your process must have the PROCMGR_AID_CLOCKSET ability enabled. For more information, see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").

**Blocking states:**

These calls don't block.

## Returns:

The only difference between these functions is the way they indicate errors:

ClockAdjust()

If an error occurs, the function returns -1 and sets [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable"). Any other value returned indicates success.

ClockAdjust_r()

EOK is returned on success. This function does **NOT** set errno. If an error occurs, the function may return any value in the Errors section.

## Errors:

### `EFAULT`

A fault occurred when the kernel tried to access the buffers provided.

### `EINVAL`

The clock ID isn't valid.

### `EPERM`

The process tried to adjust the time without having the required permission; see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").

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

### Related reference  

[ClockPeriod(), ClockPeriod_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockperiod.html "Get or set a clock period")

[ClockTime(), ClockTime_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clocktime.html "Get or set a clock")

[procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations")
