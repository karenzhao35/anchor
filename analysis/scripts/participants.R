# Draws the participants figure (one row per participant, one panel per attribute).
#
# Usage (from any folder; interactively, setwd() to analysis/ first):
#   Rscript analysis/scripts/participants.R
#
# Reads participants.csv: years_working (work experience in years, e.g.
# internships), cs_year (year level), age. Group membership is read from
# results.csv. Writes analysis/output/figures/participants.png.

args <- commandArgs(trailingOnly = FALSE)
script_path <- sub("^--file=", "", args[grep("^--file=", args)])
here <- if (length(script_path)) dirname(dirname(normalizePath(script_path))) else getwd()  # analysis/
data_dir <- file.path(here, "data")
fig_dir <- file.path(here, "output", "figures")
dir.create(fig_dir, recursive = TRUE, showWarnings = FALSE)

p <- read.csv(file.path(data_dir, "participants.csv"), stringsAsFactors = FALSE)
r <- unique(read.csv(file.path(data_dir, "results.csv"), stringsAsFactors = FALSE)[, c("person", "group")])
p$group <- r$group[match(p$person, r$person)]
stopifnot(!anyNA(p))
p <- p[order(p$group, p$person), ]

# participant colours, same as summary.R
person_col <- c(P1 = "#1b9e77", P2 = "#d95f02", P3 = "#7570b3", P4 = "#e7298a", P5 = "#66a61e")

# lim = axis range, at = ticks
panels <- list(
  list(col = "years_working", title = "Work experience", sub = "years",
       lim = c(0, 3), at = 0:3),
  list(col = "cs_year", title = "Year level", sub = "1-4", lim = c(1, 4), at = 1:4),
  list(col = "age", title = "Age", sub = "years", lim = c(20, 26), at = seq(20, 26, 2)))

draw <- function() {
  n <- nrow(p)
  gap <- 0.5  # extra space between groups
  y <- n - seq_len(n) + gap * (max(match(p$group, unique(p$group))) - match(p$group, unique(p$group)))
  top <- max(y) + 0.5
  par(mar = c(0.3, 0.3, 0.3, 0.3), family = "sans", xpd = NA)
  plot.new()
  plot.window(xlim = c(0, 10.4), ylim = c(-1.05, top + 1.0), xaxs = "i", yaxs = "i")

  for (g in unique(p$group)) {
    yg <- y[p$group == g]
    text(0.75, mean(yg) + 0.17, paste("Group", g), font = 2, cex = 0.95)
    text(0.75, mean(yg) - 0.22, paste0("(n = ", length(yg), ")"), cex = 0.8, col = "grey30")
    segments(1.45, min(yg) - 0.35, 1.45, max(yg) + 0.35, col = "grey60", lwd = 1.5)
  }
  text(1.85, y, p$person, cex = 0.95)

  x0 <- c(2.6, 5.35, 8.1)
  w <- 1.9
  for (j in seq_along(panels)) {
    pn <- panels[[j]]
    sx <- function(v) x0[j] + w * (v - pn$lim[1]) / diff(pn$lim)
    v <- p[[pn$col]]
    stopifnot(v >= pn$lim[1], v <= pn$lim[2])
    text(x0[j] + w / 2, top + 0.47, pn$title, adj = c(0.5, 0), font = 2, cex = 1)
    text(x0[j] + w / 2, top + 0.07, pn$sub, adj = c(0.5, 0), cex = 0.78, col = "grey30")
    segments(sx(pn$at), -0.45, sx(pn$at), top - 0.1, col = "grey90")
    segments(x0[j], y, x0[j] + w, y, col = "grey85", lty = 3)
    segments(x0[j], -0.45, x0[j] + w, -0.45, col = "grey50")
    text(sx(pn$at), -0.75, pn$at, cex = 0.78, col = "grey30")
    points(sx(v), y, pch = 21, cex = 1.7, bg = person_col[p$person], col = "white")
    text(sx(v) + 0.13, y + 0.24, v, cex = 0.8, font = 2)
  }
}

png(file.path(fig_dir, "participants.png"), width = 1900, height = 900, res = 250)
draw()
invisible(dev.off())
cat("Figure written to", file.path(fig_dir, "participants.png"), "\n")
