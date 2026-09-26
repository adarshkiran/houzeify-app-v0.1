import type { UploadFile } from "antd"
import type { IssueEvidenceInput } from "../domain/commandInputs"

/** Turn antd Upload files into evidence inputs (object URLs, as in daily progress). */
export function filesToEvidence(files: UploadFile[]): IssueEvidenceInput[] {
  return files.flatMap((entry) => {
    const file = entry.originFileObj
    if (!file) return []
    return [
      {
        type: file.type.startsWith("video/") ? ("video" as const) : ("photo" as const),
        url: URL.createObjectURL(file),
        caption: file.name,
      },
    ]
  })
}
