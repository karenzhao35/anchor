#include "clock.h"

static int remaining_seconds = 0;

/* Store a nonnegative duration and return 1 on success. */
int setTime(int seconds) {
    if (seconds < 0) return 0;
    remaining_seconds = seconds;
    return 1;
}

/* Clear the stored duration and return 1 if the clock was running. */
int resetTime(void) {
    if (remaining_seconds == 0) return 0;
    remaining_seconds = 0;
    return 1;
}
