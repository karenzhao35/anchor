# Regenerates the summary tables in questions.md from results.csv.
#
# Usage (from any folder; interactively, setwd() to analysis/ first):
#   Rscript analysis/scripts/summary.R
#
# results.csv is long format, one row per participant (P1-P5) x task (1, 2) x item:
#   measure = grade (0-2), confidence (0-5, idk answers already set to 0;
#             raw_value holds the original slider when it was overridden, NA = blank),
#             survey (S1-S6, 0-5), or tlx (NASA-TLX subscales MD, PD, TD, PE, EF, FR,
#             0-10 as recorded in the Google Form; PE is raw "Performance", higher =
#             more successful, so it is reversed when computing overall workload).
# Each table is printed and also written to analysis/output/tables/<name>.csv.

args <- commandArgs(trailingOnly = FALSE)
script_path <- sub("^--file=", "", args[grep("^--file=", args)])
here <- if (length(script_path)) dirname(dirname(normalizePath(script_path))) else getwd()  # analysis/
data_dir <- file.path(here, "data")
fig_dir <- file.path(here, "output", "figures")
dir.create(fig_dir, recursive = TRUE, showWarnings = FALSE)
tab_dir <- file.path(here, "output", "tables")

# raw_value: empty = not overridden, "NA" = slider was blank (kept as text)
d <- read.csv(file.path(data_dir, "results.csv"), stringsAsFactors = FALSE,
              na.strings = "", colClasses = c(raw_value = "character", task = "character"))
people <- unique(d$person)
group_of <- setNames(d$group[match(people, d$person)], people)

# value for one person / task (or tool) / measure / item
val <- function(p, measure, item, task = NULL, tool = NULL) {
  s <- d[d$person == p & d$measure == measure & d$item == item, ]
  if (!is.null(task)) s <- s[s$task == task, ]
  if (!is.null(tool)) s <- s[s$tool == tool, ]
  stopifnot(nrow(s) == 1)
  s$value
}

add_mean_row <- function(tab, digits = 2) {
  num <- vapply(tab, is.numeric, logical(1))
  m <- tab[1, , drop = FALSE]
  m[1, ] <- NA
  m[1, !num] <- ""
  m$person <- "Mean"
  m[1, num] <- round(colMeans(tab[, num, drop = FALSE]), digits)
  rbind(tab, m)
}

show <- function(tab, name, title) {
  cat("\n==", title, "==\n")
  print(tab, row.names = FALSE)
  path <- file.path(tab_dir, paste0(name, ".csv"))
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)
  write.csv(tab, path, row.names = FALSE)
}

qs <- c("u1a", "u1b", "u2a", "u2b")

# ---- Score summary ----
scores <- data.frame(person = people, group = unname(group_of[people]))
for (k in 1:2) {
  cols <- paste0("T", k, " ", qs)
  for (i in seq_along(qs)) scores[[cols[i]]] <- sapply(people, val, measure = "grade", item = qs[i], task = k)
  scores[[paste0("Task ", k, " /8")]] <- rowSums(scores[, cols])
}
scores[["Total /16"]] <- scores[["Task 1 /8"]] + scores[["Task 2 /8"]]
show(add_mean_row(scores, 1), "scores/score_summary", "Score summary")

# ---- Group means ----
gm <- aggregate(scores[, c("Task 1 /8", "Task 2 /8", "Total /16")],
                by = list(group = scores$group), FUN = mean)
gm$n <- as.vector(table(scores$group)[gm$group])
gm[, 2:4] <- round(gm[, 2:4], 2)
show(gm, "scores/group_means", "Group means")

# ---- Anchor vs. Claude Code ----
by_tool <- data.frame(person = people, group = unname(group_of[people]))
for (t in c("Anchor", "Claude Code")) {
  tag <- if (t == "Anchor") "Anchor" else "CC"
  by_tool[[paste(tag, "task")]] <- sapply(people, function(p)
    unique(d$task[d$person == p & d$tool == t]))
  for (u in c("U1", "U2")) {
    by_tool[[paste(tag, u, "/4")]] <- sapply(people, function(p)
      sum(d$value[d$person == p & d$tool == t & d$measure == "grade" & d$proxy == u]))
  }
  by_tool[[paste(tag, "/8")]] <- by_tool[[paste(tag, "U1 /4")]] + by_tool[[paste(tag, "U2 /4")]]
}
by_tool[["Anchor - CC"]] <- by_tool[["Anchor /8"]] - by_tool[["CC /8"]]
show(add_mean_row(by_tool, 1), "scores/anchor_vs_cc", "Anchor vs. Claude Code (scores)")
cat("Participants scoring lower with Anchor:", sum(by_tool[["Anchor - CC"]] < 0), "\n")

# ---- Confidence ----
conf <- data.frame(person = people)
for (k in 1:2) {
  cols <- paste0("T", k, " ", qs)
  for (i in seq_along(qs)) conf[[cols[i]]] <- sapply(people, val, measure = "confidence", item = qs[i], task = k)
  conf[[paste0("T", k, " mean")]] <- round(rowMeans(conf[, cols]), 2)
}
show(add_mean_row(conf, 2), "confidence/confidence", "Confidence (idk = 0)")

zeroed <- d[d$measure == "confidence" & !is.na(d$raw_value), c("person", "task", "item", "value", "raw_value")]
show(zeroed, "confidence/confidence_zeroed", "Confidence answers set to 0 (raw slider; NA = blank)")

conf_tool <- data.frame(person = people)
for (t in c("Anchor", "Claude Code")) {
  conf_tool[[t]] <- sapply(people, function(p)
    mean(d$value[d$person == p & d$tool == t & d$measure == "confidence"]))
}
show(add_mean_row(conf_tool, 2), "confidence/confidence_by_tool", "Confidence by tool (mean of four answers)")

# ---- Post-task survey ----
items <- paste0("S", 1:6)
survey_tab <- function(t) {
  s <- data.frame(person = people,
                  task = sapply(people, function(p) unique(d$task[d$person == p & d$tool == t])))
  for (i in items) s[[i]] <- sapply(people, val, measure = "survey", item = i, tool = t)
  s[["Sum /30"]] <- rowSums(s[, items])
  s
}
sa <- survey_tab("Anchor")
sc <- survey_tab("Claude Code")
show(add_mean_row(sa, 1), "survey/survey_anchor", "Survey: Anchor")
show(add_mean_row(sc, 1), "survey/survey_cc", "Survey: Claude Code")
show(data.frame(person = people, `Anchor - CC` = sa[["Sum /30"]] - sc[["Sum /30"]], check.names = FALSE),
     "survey/survey_diff", "Survey sum difference (Anchor - CC)")

# ---- NASA-TLX ----
# Raw (unweighted) TLX: mean of the six subscales with Performance reversed
# (10 - PE) so that higher always means more workload.
tlx_items <- c("MD", "PD", "TD", "PE", "EF", "FR")
tlx_names <- c(MD = "Mental demand", PD = "Physical demand", TD = "Temporal demand",
               PE = "Performance", EF = "Effort", FR = "Frustration")
tlx_max <- 10
tlx_tab <- function(t) {
  s <- data.frame(person = people,
                  task = sapply(people, function(p) unique(d$task[d$person == p & d$tool == t])))
  for (i in tlx_items) s[[i]] <- sapply(people, val, measure = "tlx", item = i, tool = t)
  w <- s[, tlx_items]
  w$PE <- tlx_max - w$PE
  s[["Raw TLX"]] <- rowMeans(w)
  s
}
ta <- tlx_tab("Anchor")
tc <- tlx_tab("Claude Code")
r2 <- function(tab) { tab[["Raw TLX"]] <- round(tab[["Raw TLX"]], 2); tab }
show(r2(add_mean_row(ta, 2)), "tlx/tlx_anchor", "NASA-TLX: Anchor (0-10; Raw TLX reverses PE)")
show(r2(add_mean_row(tc, 2)), "tlx/tlx_cc", "NASA-TLX: Claude Code (0-10; Raw TLX reverses PE)")
tlx_diff <- data.frame(person = people)
for (i in c(tlx_items, "Raw TLX")) tlx_diff[[i]] <- ta[[i]] - tc[[i]]
show(r2(add_mean_row(tlx_diff, 2)), "tlx/tlx_diff", "NASA-TLX difference (Anchor - CC; negative = less workload with Anchor, except PE)")
cat("Participants with lower Raw TLX under Anchor:", sum(tlx_diff[["Raw TLX"]] < 0), "of", length(people), "\n")

# ---- Overall mean differences (Anchor - Claude Code) ----
# One row per measure. "Better" says which direction favours a tool; the
# Anchor better / tie / CC better counts are per participant (paired).
diff_row <- function(measure, scale, better, a, c) {
  dd <- a - c
  if (better == "lower") dd_good <- -dd else dd_good <- dd
  data.frame(Measure = measure, Scale = scale, Better = better,
             Anchor = round(mean(a), 2), `Claude Code` = round(mean(c), 2),
             `Anchor - CC` = round(mean(a) - mean(c), 2), `SD of diff` = round(sd(dd), 2),
             `Anchor better` = sum(dd_good > 0), Tie = sum(dd_good == 0), `CC better` = sum(dd_good < 0),
             check.names = FALSE)
}
surv_names <- c(S1 = "Survey S1 (explain to teammate)", S2 = "Survey S2 (know files/functions)",
                S3 = "Survey S3 (understand why)", S4 = "Survey S4 (know where to debug)",
                S5 = "Survey S5 (tool helped answer)", S6 = "Survey S6 (tool helped understanding)")
overall <- rbind(
  diff_row("Comprehension score", "0-8", "higher", by_tool[["Anchor /8"]], by_tool[["CC /8"]]),
  diff_row("Localization (U1)", "0-4", "higher", by_tool[["Anchor U1 /4"]], by_tool[["CC U1 /4"]]),
  diff_row("Justification (U2)", "0-4", "higher", by_tool[["Anchor U2 /4"]], by_tool[["CC U2 /4"]]),
  diff_row("Confidence (mean of 4)", "0-5", "higher", conf_tool[["Anchor"]], conf_tool[["Claude Code"]]),
  diff_row("Survey sum", "0-30", "higher", sa[["Sum /30"]], sc[["Sum /30"]]),
  do.call(rbind, lapply(items, function(i) diff_row(surv_names[[i]], "0-5", "higher", sa[[i]], sc[[i]]))),
  diff_row("Raw TLX (PE reversed)", "0-10", "lower", ta[["Raw TLX"]], tc[["Raw TLX"]]),
  do.call(rbind, lapply(tlx_items, function(i)
    diff_row(paste("TLX", tlx_names[[i]]), "0-10", if (i == "PE") "higher" else "lower", ta[[i]], tc[[i]])))
)
show(overall, "overall_diff", "Overall mean differences (Anchor - Claude Code)")

# ---- Box plots: Anchor vs. Claude Code ----
# Each box has only n = 5 points, so every participant is drawn as a dot and
# their Anchor and Claude Code values are joined by a line (paired design).
# Dots are nudged sideways by participant so ties don't hide each other.
# Writes analysis/output/figures/panels/<name>.png plus combined
# analysis/output/figures/scores.png and survey.png.
panel_dir <- file.path(fig_dir, "panels")
dir.create(panel_dir, showWarnings = FALSE)

pcol <- setNames(c("#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e")[seq_along(people)], people)
nudge <- setNames(seq(-0.15, 0.15, length.out = length(people)), people)

panels <- list(
  list(name = "score_total", title = "Comprehension score", ylab = "Score /8", ylim = c(0, 8),
       a = by_tool[["Anchor /8"]], c = by_tool[["CC /8"]]),
  list(name = "score_u1", title = "Localization (U1)", ylab = "Score /4", ylim = c(0, 4),
       a = by_tool[["Anchor U1 /4"]], c = by_tool[["CC U1 /4"]]),
  list(name = "score_u2", title = "Justification (U2)", ylab = "Score /4", ylim = c(0, 4),
       a = by_tool[["Anchor U2 /4"]], c = by_tool[["CC U2 /4"]]),
  list(name = "confidence", title = "Confidence (mean of 4 answers)", ylab = "Confidence (0-5)", ylim = c(0, 5),
       a = conf_tool[["Anchor"]], c = conf_tool[["Claude Code"]]),
  list(name = "survey_sum", title = "Post-task survey", ylab = "Sum of S1-S6 /30", ylim = c(0, 30),
       a = sa[["Sum /30"]], c = sc[["Sum /30"]]),
  list(name = "tlx_raw", title = "NASA-TLX workload (lower = better)", ylab = "Raw TLX (0-10)", ylim = c(0, 10),
       a = ta[["Raw TLX"]], c = tc[["Raw TLX"]])
)

paired_box <- function(pn, legend = TRUE) {
  boxplot(list(Anchor = pn$a, `Claude Code` = pn$c), ylim = pn$ylim, main = pn$title,
          ylab = pn$ylab, col = c("#cfe3f5", "#f5dccf"), border = "grey40",
          outline = FALSE, boxwex = 0.5, las = 1)
  for (i in seq_along(people)) {
    x <- c(1, 2) + nudge[people[i]]
    y <- c(pn$a[i], pn$c[i])
    lines(x, y, col = adjustcolor(pcol[people[i]], 0.6), lwd = 1.5)
    points(x, y, pch = 19, col = pcol[people[i]], cex = 1.2)
  }
  points(c(1, 2), c(mean(pn$a), mean(pn$c)), pch = 4, cex = 1.6, lwd = 2.5)
  if (legend) legend("topright", legend = c(people, "mean"), col = c(pcol, "black"),
                     pch = c(rep(19, length(people)), 4), bty = "n", cex = 0.8)
}

for (pn in panels) {
  png(file.path(panel_dir, paste0(pn$name, ".png")), width = 1000, height = 1200, res = 200)
  paired_box(pn)
  invisible(dev.off())
}

# Combined figures: scores (total, U1, U2) and survey measures (confidence,
# post-task Likert survey, NASA-TLX), each with a shared legend panel.
combined_png <- function(file, pns) {
  png(file.path(fig_dir, file), width = 800 * length(pns) + 400, height = 1200, res = 200)
  layout(matrix(seq_len(length(pns) + 1), nrow = 1), widths = c(rep(1, length(pns)), 0.5))
  par(mar = c(3, 4.5, 3, 1))
  for (pn in pns) paired_box(pn, legend = FALSE)
  plot.new()
  legend("center", legend = c(people, "mean"), col = c(pcol, "black"),
         pch = c(rep(19, length(people)), 4), bty = "n", cex = 1.2, title = "Participant")
  invisible(dev.off())
}
by_name <- setNames(panels, vapply(panels, `[[`, "", "name"))
combined_png("scores.png", by_name[c("score_total", "score_u1", "score_u2")])
combined_png("survey.png", by_name[c("confidence", "survey_sum", "tlx_raw")])
# NASA-TLX subscales, one paired panel each (as recorded; PE higher = more successful)
png(file.path(panel_dir, "tlx_subscales.png"), width = 2400, height = 1600, res = 200)
par(mfrow = c(2, 3), mar = c(3, 4.5, 3, 1))
for (i in tlx_items) {
  lab <- if (i == "PE") "Performance (higher = more successful)" else paste(tlx_names[[i]], "(higher = more)")
  paired_box(list(title = tlx_names[[i]], ylab = lab, ylim = c(0, tlx_max),
                  a = ta[[i]], c = tc[[i]]), legend = i == "PD")
}
invisible(dev.off())

cat("\nPlots written to", panel_dir, "and", file.path(fig_dir, c("scores.png", "survey.png")), "\n")
