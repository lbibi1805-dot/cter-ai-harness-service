---
title: "ClockPeriod(), ClockPeriod_r()"
category: "Clock-and-timer-services"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, clock, timer]
---

# ClockPeriod(), ClockPeriod_r()

_Get or set a clock period_

## Synopsis:

```c
#include <sys/neutrino.h>

int ClockPeriod( clockid_t id,
                 const struct _clockperiod * new,
                 struct _clockperiod * old,
                 int reserved );

int ClockPeriod_r( clockid_t id,
                   const struct _clockperiod * new,
                   struct _clockperiod * old,
                   int reserved );
```

## Arguments:

**id** —

The clock ID of the clock; one of the following:

- CLOCK_REALTIME — the clock that maintains the system time.
- CLOCK_SOFTTIME — (a QNX Neutrino extension) this clock is active only when the processor _isn't_ in a power-saving mode. For example, an application using a CLOCK_SOFTTIME timer to sleep wouldn't wake up the processor when the application was due to wake up. This will allow the processor to enter a power-saving mode.

    While the processor isn't in a power-saving mode, CLOCK_SOFTTIME behaves the same as CLOCK_REALTIME.

- CLOCK_MONOTONIC — this clock always increases at a constant rate and can't be adjusted.

For more information about the different clocks, see “[Other clock sources](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_timer_otherclock.html)” in the Clocks, Timers, and Getting a Kick Every So Often of Getting Started with QNX Neutrino.

**new** —

NULL, or a pointer to a _clockperiod structure that contains the period to set the clock to. This structure contains at least the following members:

- uint32_t nsec—the period of the clock, in nanoseconds.
- int32_t fract—reserved for future fractional nanoseconds. Set this member to zero.

You can set the clock period only for CLOCK_REALTIME.

**old** —

NULL, or a pointer to a _clockperiod structure where the function can store the current period (before being changed by a non-NULL new).

**reserved** —

Set this argument to 0.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

You can use the ClockPeriod() and ClockPeriod_r() kernel calls to get or set the clock period of the clock. These functions are identical except in the way they indicate errors. See the [Returns](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockperiod.html#clockperiod__Returns) section for details.

- If you want to get the clock period, consider calling [clock_getres()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_getres.html "Get the resolution of the clock") instead of using these kernel calls directly.
- In order to set the clock period, your process must have the PROCMGR_AID_CLOCKPERIOD ability enabled. For more information, see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").
- If you're using adaptive partitioning, and you change the tick size of the system at runtime, do so before defining the adaptive partitioning scheduler's window size. That's because QNX Neutrino converts the window size from milliseconds to clock ticks for internal use. For more information, see the Adaptive Partitioning [_User's Guide_](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.adaptivepartitioning.userguide/topic/about_howtouseguide_.html).

All the timer_*() calls operate with an accuracy no better than the clock period. Every moment within the microkernel is referred to as a _tick_. A tick's initial length is determined by the clock rate of your processor:

|CPU clock speed:|Default value:|
|---|---|
|≥ 40MHz|1 millisecond|
|< 40MHz|10 milliseconds|

Since a very small tick size imposes an interrupt load on the system, and can consume all available processor cycles, the kernel call limits how small a period can be specified. The lowest clock period that can currently be set on any machine is 10 microseconds.

If an attempt is made to set a value that the kernel believes to be unsafe, the call fails with an EINVAL. The timeslice rate (for “round-robin” and “other” scheduling policies) is always four times the clock period (this isn't changeable).

**Blocking states**

These calls don't block.

## Returns:

The only difference between these functions is the way they indicate errors:

ClockPeriod()

If an error occurs, this function returns -1 is and sets [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable"). Any other value returned indicates success.

ClockPeriod_r()

EOK is returned on success. This function does **NOT** set errno. If an error occurs, the function can return any value in the Errors section.

## Errors:

### `EFAULT`

A fault occurred when the kernel tried to access the buffers provided.

### `EINVAL`

One of the following occurred:

- The clock ID is invalid.
- You tried to set the period for a clock ID other than CLOCK_REALTIME.
- You tried to set the period to a value that isn't in a range considered safe.

### `EPERM`

The process tried to change the period of the clock without having the required permission; see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").

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

[clock_getres()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clock_getres.html "Get the resolution of the clock")

[ClockAdjust(), ClockAdjust_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/clockadjust.html "Adjust the time of a clock")

[procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations")
