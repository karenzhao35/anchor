#include <stdio.h>
#include <string.h>

#include "clock.h"

/* Route a command to the clock and return the reply shown by the server. */
const char *handleCommand(const char *command) {
    if (strcmp(command, "RESET") == 0) {
        return resetTime() ? "RESET OK" : "ALREADY STOPPED";
    }
    return "UNKNOWN COMMAND";
}

/* Run RESET twice to show the replies for a running and stopped clock. */
int main(void) {
    setTime(30);
    puts(handleCommand("RESET"));
    puts(handleCommand("RESET"));
    return 0;
}
