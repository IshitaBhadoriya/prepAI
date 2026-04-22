function sanitize(value) {
  return String(value ?? "")
    .replace(/[^\u0020-\u007E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfText(value) {
  return sanitize(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(text, maxChars = 92) {
  const words = sanitize(text).split(" ").filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function createPage(lines) {
  const content = [
    "BT",
    "/F1 11 Tf",
    "50 790 Td",
    "14 TL",
    ...lines.map((line) => `(${escapePdfText(line)}) Tj T*`),
    "ET",
  ].join("\n");

  return content;
}

function buildReportLines({ feedback, answers, context }) {
  const title = "PrepForge Interview Feedback Report";
  const generated = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const lines = [
    title,
    `Generated: ${generated}`,
    `Interview: ${context.mode || "Interview"} | Difficulty: ${context.difficulty || "N/A"} | Focus: ${context.subjectSummary || "General"}`,
    "",
    "Overall Scores",
    `Technical / Content: ${feedback.overallTechScore}/10`,
    `Communication: ${feedback.overallCommScore}/10`,
    `Completeness: ${feedback.overallCompletenessScore}/10`,
    "",
    "Summary",
    ...wrapText(feedback.summary),
    "",
    "What Went Well",
    ...(feedback.whatWentWell || []).flatMap((item) => wrapText(`- ${item}`)),
    "",
    "Areas To Improve",
    ...(feedback.areasToImprove || []).flatMap((item) => wrapText(`- ${item}`)),
    "",
    "Study Suggestions",
    ...(feedback.studySuggestions || []).flatMap((item) => wrapText(`- ${item}`)),
    "",
    "Question Breakdown",
  ];

  (feedback.perQuestion || []).forEach((item, index) => {
    const answer = answers?.[index];
    lines.push("");
    lines.push(`Question ${index + 1}`);
    lines.push(...wrapText(`Prompt: ${answer?.question || "Not available"}`));
    lines.push(...wrapText(`Your answer: ${answer?.answer || "Not available"}`));
    lines.push(
      `Scores: Technical ${item.techScore}/10 | Communication ${item.commScore}/10 | Completeness ${item.completenessScore}/10`,
    );

    if (item.whatWentWell) {
      lines.push(...wrapText(`What went well: ${item.whatWentWell}`));
    }
    if (item.whatWasMissed) {
      lines.push(...wrapText(`What was missed: ${item.whatWasMissed}`));
    }
    if (item.idealAnswer) {
      lines.push(...wrapText(`Ideal answer: ${item.idealAnswer}`));
    }
  });

  return lines;
}

function createPdf(lines) {
  const pageSize = 52;
  const pages = [];

  for (let index = 0; index < lines.length; index += pageSize) {
    pages.push(createPage(lines.slice(index, index + pageSize)));
  }

  const objects = ["<< /Type /Catalog /Pages 2 0 R >>"];
  const kids = pages
    .map((_, index) => `${3 + index * 2} 0 R`)
    .join(" ");
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);

  pages.forEach((page, index) => {
    const pageObjectNumber = 3 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${3 + pages.length * 2} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
    );
    objects.push(
      `<< /Length ${page.length} >>\nstream\n${page}\nendstream`,
    );
  });

  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return pdf;
}

export function downloadFeedbackPdf({ feedback, answers, context }) {
  const lines = buildReportLines({ feedback, answers, context });
  const pdf = createPdf(lines);
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `prepforge-feedback-${date}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
