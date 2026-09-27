import { useEffect, useRef, useState } from "react"
import { getSpeechRecognition, type SpeechRecognitionLike } from "./speechRecognition"

/**
 * Speech-to-text into a text value: spoken words are appended to what is
 * already typed, with interim words previewed live. Shared by VoiceTextArea
 * and the message composer.
 */
export function useDictation(value: string, onText: (next: string) => void) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const [listening, setListening] = useState(false)
  const [supported] = useState(() => Boolean(getSpeechRecognition()))
  const [status, setStatus] = useState<string>()
  const baseValueRef = useRef(value)

  useEffect(() => {
    if (!listening) baseValueRef.current = value
  }, [value, listening])

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [])

  const stop = () => {
    recognitionRef.current?.stop()
    setListening(false)
  }

  const start = () => {
    const Recognition = getSpeechRecognition()
    if (!Recognition) {
      setStatus("Voice input is not supported in this browser. Try Chrome or Edge.")
      return
    }

    recognitionRef.current?.abort()
    const recognition = new Recognition()
    recognitionRef.current = recognition
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-IN"
    baseValueRef.current = value
    setStatus("Listening… speak clearly about the site work.")
    setListening(true)

    recognition.onresult = (event) => {
      let finalChunk = ""
      let interimChunk = ""
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        if (result.isFinal) finalChunk += result[0].transcript
        else interimChunk += result[0].transcript
      }

      if (finalChunk) {
        const joined = [baseValueRef.current.trim(), finalChunk.trim()].filter(Boolean).join(" ")
        baseValueRef.current = joined
        onText(joined)
        setStatus("Captured. Keep speaking, or tap the mic to stop.")
        return
      }

      if (interimChunk) {
        onText([baseValueRef.current.trim(), interimChunk.trim()].filter(Boolean).join(" "))
      }
    }

    recognition.onerror = (event) => {
      setListening(false)
      if (event.error === "not-allowed") {
        setStatus("Microphone permission was blocked. Allow mic access and try again.")
        return
      }
      if (event.error === "no-speech") {
        setStatus("No speech heard. Tap the mic and try again.")
        return
      }
      setStatus("Could not capture speech. You can still type the update.")
    }

    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }

    try {
      recognition.start()
    } catch {
      setListening(false)
      setStatus("Could not start the microphone. You can still type the update.")
    }
  }

  const toggle = () => (listening ? stop() : start())
  const clearStatus = () => setStatus(undefined)

  return { supported, listening, status, toggle, clearStatus }
}
