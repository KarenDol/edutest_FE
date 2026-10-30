"use client"

import { getAccessToken, clearAccessToken } from "@/lib/auth-token"
import { getPublicApiBase } from "@/lib/public-api"

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function apiUrl(path: string): string {
  const base = getPublicApiBase()
  const p = path.startsWith("/") ? path : `/${path}`
  return `${base}${p}`
}

export async function apiClientJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken()
  if (!token) {
    throw new ApiError(401, "Unauthorized")
  }
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers as Record<string, string> | undefined),
    },
  })
  const text = await res.text()
  if (res.status === 401) {
    clearAccessToken()
  }
  if (!res.ok) {
    let msg = text
    try {
      const j = JSON.parse(text) as { detail?: string }
      if (j.detail) msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail)
    } catch {
      /* use text */
    }
    throw new ApiError(res.status, msg)
  }
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export async function apiClientUpload<T>(path: string, file: File): Promise<T> {
  const token = getAccessToken()
  if (!token) {
    throw new ApiError(401, "Unauthorized")
  }
  const body = new FormData()
  body.append("file", file)
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body,
  })
  const text = await res.text()
  if (res.status === 401) {
    clearAccessToken()
  }
  if (!res.ok) {
    let msg = text
    try {
      const j = JSON.parse(text) as { detail?: string }
      if (j.detail) msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail)
    } catch {
      /* use text */
    }
    throw new ApiError(res.status, msg)
  }
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export async function apiClientForm<T>(path: string, form: FormData): Promise<T> {
  const token = getAccessToken()
  if (!token) {
    throw new ApiError(401, "Unauthorized")
  }
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  })
  const text = await res.text()
  if (res.status === 401) {
    clearAccessToken()
  }
  if (!res.ok) {
    let msg = text
    try {
      const j = JSON.parse(text) as { detail?: string }
      if (j.detail) msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail)
    } catch {
      /* use text */
    }
    throw new ApiError(res.status, msg)
  }
  if (!text) return undefined as T
  return JSON.parse(text) as T
}
