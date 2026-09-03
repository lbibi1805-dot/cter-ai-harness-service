---
title: "ClockCycles()"
category: "Clock-and-timer-services"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, clock, timer]
---

# ClockCycles()
_Get the number of clock cycles_

## Synopsis:

```c
#include <sys/neutrino.h>
#include <inttypes.h>

uint64_t ClockCycles( void );
```

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The ClockCycles() kernel call returns the current value of a free-running 64-bit cycle counter. This is implemented on each processor as a high-performance mechanism for timing short intervals.

Several CPU architectures have an instruction that reads such a free-running counter (e.g., x86 has the RDTSC instruction that reads the Time Stamp Counter). For processors that don't implement such an instruction in hardware, the kernel emulates one. This provides a lower time resolution than if the instruction is provided (e.g., 838.095345 nanoseconds on an IBM PC-compatible system).

In all cases, the [SYSPAGE_ENTRY(qtime)->cycles_per_sec](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/syspage_entry.html "Return an entry from the system page") field gives the number of ClockCycles() increments in one second.

The cycle counter wraps every number of seconds as calculated by:

(~(uint64_t)0) / SYSPAGE_ENTRY(qtime)->cycles_per_sec

In QNX Neutrino 7.0 or later, we require that the hardware underlying ClockCycles() be synchronized across all processors on an SMP system. This means that you no longer have to call ThreadCtl( _NTO_TCTL_RUNMASK, ...) to prevent threads from migrating to another processor between calls to ClockCycles().

**Blocking states:**

This call doesn't block.

## Examples:

See [SYSPAGE_ENTRY()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/syspage_entry.html "Return an entry from the system page").

## Classification:

[QNX Neutrino](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|No|
> |Interrupt handler|Yes|
> |Signal handler|Yes|
> |Thread|Yes|

### Related concepts  

[Clocks, Timers, and Getting a Kick Every So Often (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_timer.html "Clocks, Timers, and Getting a Kick Every So Often (Getting Started with QNX Neutrino)")

### Related reference  

[SYSPAGE_ENTRY()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/syspage_entry.html "Return an entry from the system page")

[ThreadCtl(), ThreadCtl_r(), ThreadCtlExt(), ThreadCtlExt_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/threadctl.html "Control a thread")
