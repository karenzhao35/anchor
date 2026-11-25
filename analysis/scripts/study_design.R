# Draws the counterbalancing figure (group x round grid of tool--task pairings).
#
# Usage (from any folder; interactively, setwd() to analysis/ first):
#   Rscript analysis/scripts/study_design.R
#
# Group membership and tool/task/round assignments are read from results.csv.
# Writes analysis/output/figures/study_design.png and analysis/output/figures/study_design.pdf.

args <- commandArgs(trailingOnly = FALSE)
script_path <- sub("^--file=", "", args[grep("^--file=", args)])
here <- if (length(script_path)) dirname(dirname(normalizePath(script_path))) else getwd()  # analysis/
data_dir <- file.path(here, "data")
fig_dir <- file.path(here, "output", "figures")
dir.create(fig_dir, recursive = TRUE, showWarnings = FALSE)

d <- read.csv(file.path(data_dir, "results.csv"), stringsAsFactors = FALSE, na.strings = "")

# one row per person x round: which tool on which task
a <- unique(d[, c("person", "group", "round", "task", "tool")])
groups <- sort(unique(a$group))
rounds <- sort(unique(a$round))

task_label <- c(`1` = "T1: downloads", `2` = "T2: sessions")
tool_fill <- c(Anchor = "#cfe3f5", `Claude Code` = "#f5dccf")  # same as summary.R
tool_border <- c(Anchor = "#4a7fb0", `Claude Code` = "#b0714a")

draw <- function() {
  par(mar = c(0.5, 0.5, 0.5, 0.5), family = "sans")
  # x: label column [0, 1.6], rounds at [1.8, 3.8] and [4.4, 6.4]
  # y: one band per group, top to bottom
  plot.new()
  plot.window(xlim = c(0, 6.6), ylim = c(0, length(groups) + 0.6), xaxs = "i", yaxs = "i")
  col_x <- c(1.8, 4.4)
  w <- 2.0

  for (j in seq_along(rounds))
    text(col_x[j] + w / 2, length(groups) + 0.3, paste("Round", rounds[j]), font = 2, cex = 1.1)

  for (i in seq_along(groups)) {
    g <- groups[i]
    y0 <- length(groups) - i + 0.1
    y1 <- y0 + 0.8
    ppl <- sort(unique(a$person[a$group == g]))
    text(0.8, (y0 + y1) / 2 + 0.12, paste0("Group ", g, " (n = ", length(ppl), ")"),
         font = 2, cex = 1.05)
    text(0.8, (y0 + y1) / 2 - 0.15, paste(ppl, collapse = ", "), cex = 0.9, col = "grey30")

    for (j in seq_along(rounds)) {
      s <- a[a$group == g & a$round == rounds[j], ][1, ]
      rect(col_x[j], y0, col_x[j] + w, y1, col = tool_fill[s$tool],
           border = tool_border[s$tool], lwd = 2)
      text(col_x[j] + w / 2, (y0 + y1) / 2 + 0.12, s$tool, font = 2, cex = 1.05)
      text(col_x[j] + w / 2, (y0 + y1) / 2 - 0.15, task_label[as.character(s$task)], cex = 0.95)
    }
    arrows(col_x[1] + w + 0.08, (y0 + y1) / 2, col_x[2] - 0.08, (y0 + y1) / 2,
           length = 0.08, lwd = 1.5, col = "grey40")
  }
}

png(file.path(fig_dir, "study_design.png"), width = 1600, height = 700, res = 250)
draw()
invisible(dev.off())
pdf(file.path(fig_dir, "study_design.pdf"), width = 6.4, height = 2.8)
draw()
invisible(dev.off())
cat("Figure written to", file.path(fig_dir, "study_design.png"), "and .pdf\n")
