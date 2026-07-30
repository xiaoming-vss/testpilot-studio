import { DownloadOutlined } from '@ant-design/icons'
import { Alert, Button, Empty, Modal, Spin, Tabs } from 'antd'
import { useMutation } from '@tanstack/react-query'
import { renderAsync } from 'docx-preview'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuthStore } from '@/features/auth/store/auth.store'
import type { Requirement } from '@/features/requirements/types'
import {
  getRequirementDocumentDisplayName,
  resolveRequirementDocumentPreviewUrl,
  resolveRequirementDocumentUrl,
} from '@/features/requirements/utils/requirementDocument'
import { api } from '@/services/api'
import { message } from '@/shared/utils/feedback'
import { getErrorMessage } from '@/utils/format'
import '@/features/testing/styles/index.css'

function isWordDocument(documentType?: Requirement['documentType']) {
  return documentType === 'word' || documentType === 'docx'
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

async function fetchBlobWithAuth(url: string, token?: string | null) {
  const response = await fetch(url, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  })

  if (!response.ok) {
    throw new Error(`文档加载失败（${response.status}）`)
  }

  return response.blob()
}

function RequirementDocxPreview({
  requirementId,
  documentUrl,
  previewUrl,
  documentName,
}: {
  requirementId?: string
  documentUrl: string
  previewUrl: string
  documentName: string
}) {
  const token = useAuthStore((state) => state.token)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const downloadMutation = useMutation({
    mutationFn: async () => {
      if (requirementId) {
        return api.downloadRequirementDocument(requirementId)
      }

      const sourceUrl = documentUrl || previewUrl
      if (!sourceUrl) {
        throw new Error('暂无可下载文档')
      }

      return {
        blob: await fetchBlobWithAuth(sourceUrl, token),
        filename: documentName,
      }
    },
    onSuccess: (response) => {
      saveBlob(response.blob, response.filename || documentName || 'requirement-document')
    },
    onError: (downloadError) => {
      message.error(getErrorMessage(downloadError))
    },
  })

  useEffect(() => {
    let disposed = false
    const container = containerRef.current

    async function loadDocument() {
      if ((!previewUrl && !requirementId) || !container) return

      setLoading(true)
      setError(null)
      container.innerHTML = ''

      try {
        const blob = requirementId
          ? (await api.downloadRequirementDocument(requirementId)).blob
          : await fetchBlobWithAuth(previewUrl || documentUrl, token)

        if (blob.size === 0) {
          throw new Error('文档内容为空，请下载原文件确认是否上传成功')
        }

        const arrayBuffer = await blob.arrayBuffer()
        if (disposed) return
        const signature = new Uint8Array(arrayBuffer.slice(0, 4))
        const isZipDocument = signature[0] === 0x50 && signature[1] === 0x4b

        if (!isZipDocument) {
          throw new Error('文档内容不是有效的 DOCX 文件，请下载原文件确认')
        }

        await renderAsync(arrayBuffer, container, undefined, {
          className: 'requirement-docx',
          inWrapper: false,
          breakPages: false,
          ignoreWidth: true,
          ignoreHeight: true,
        })

        if (!disposed) {
          setLoading(false)
        }
      } catch (loadError) {
        if (disposed) return
        const nextError = loadError instanceof Error ? loadError.message : '文档预览失败'
        setError(nextError)
        setLoading(false)
      }
    }

    void loadDocument()

    return () => {
      disposed = true
      if (container) {
        container.innerHTML = ''
      }
    }
  }, [documentUrl, previewUrl, requirementId, token])

  return (
    <div className="requirement-document-preview-shell">
      {loading ? (
        <div className="requirement-document-preview-state">
          <Spin />
          <span>文档预览加载中...</span>
        </div>
      ) : null}
      {error ? (
        <div className="requirement-document-preview-state error">
          <span>{error}</span>
          <Button type="link" loading={downloadMutation.isPending} onClick={() => downloadMutation.mutate()}>
            下载文档：{documentName}
          </Button>
        </div>
      ) : null}
      <div
        ref={containerRef}
        className={`requirement-document-docx-host${loading ? ' loading' : ''}${error ? ' hidden' : ''}`}
      />
    </div>
  )
}

function RequirementTextPreview({ previewUrl }: { previewUrl: string }) {
  const token = useAuthStore((state) => state.token)
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false

    async function loadText() {
      if (!previewUrl) {
        setContent('')
        setError(null)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const response = await fetch(previewUrl, {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : undefined,
        })

        if (!response.ok) {
          throw new Error(`文本加载失败（${response.status}）`)
        }

        const text = await response.text()
        if (disposed) return
        setContent(text)
        setLoading(false)
      } catch (loadError) {
        if (disposed) return
        setError(loadError instanceof Error ? loadError.message : '文本预览失败')
        setLoading(false)
      }
    }

    void loadText()

    return () => {
      disposed = true
    }
  }, [previewUrl, token])

  return (
    <div className="requirement-document-text-host">
      {loading ? (
        <div className="requirement-document-preview-state">
          <Spin />
          <span>文本预览加载中...</span>
        </div>
      ) : null}
      {error ? (
        <div className="requirement-document-preview-state error">
          <span>{error}</span>
        </div>
      ) : null}
      {!loading && !error ? (
        <div className="requirement-document-text-article">{content || '暂无源文件内容'}</div>
      ) : null}
    </div>
  )
}

type RequirementDocumentPreviewModalProps = {
  open: boolean
  onClose: () => void
  requirementId?: string
  requirementName?: string
  documentType?: Requirement['documentType']
  documentContent?: string
  documentFilename?: string
  documentDownloadUrl?: string
}

type RequirementDocumentPreviewContentProps = Omit<RequirementDocumentPreviewModalProps, 'open' | 'onClose'> & {
  embedded?: boolean
}

export function RequirementDocumentPreviewContent({
  requirementId,
  requirementName,
  documentType,
  documentContent,
  documentFilename,
  documentDownloadUrl,
  embedded = false,
}: RequirementDocumentPreviewContentProps) {
  const isWord = isWordDocument(documentType)
  const sourceDocumentPath = documentDownloadUrl || (requirementId ? `/v1/requirements/${requirementId}/download` : undefined)
  const documentUrl = useMemo(() => resolveRequirementDocumentUrl(sourceDocumentPath), [sourceDocumentPath])
  const documentName = useMemo(
    () =>
      getRequirementDocumentDisplayName({
        documentType,
        documentFilename,
        requirementName,
      }),
    [documentFilename, documentType, requirementName],
  )
  const previewUrl = useMemo(() => resolveRequirementDocumentPreviewUrl(documentUrl), [documentUrl])
  const documentTypeLabel = isWord ? 'Word 文档' : '文本源文件'
  const understandingResult = documentContent?.trim() ?? ''
  const downloadMutation = useMutation({
    mutationFn: () => api.downloadRequirementDocument(requirementId!),
    onSuccess: (response) => {
      saveBlob(response.blob, response.filename || documentName || 'requirement-document')
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
    },
  })

  function handleDownload() {
    if (requirementId) {
      downloadMutation.mutate()
      return
    }

    if (documentUrl) {
      window.open(documentUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const documentPreviewContent = (
    <div
      className={`requirement-document-modal-stage${
        isWord ? ' docx-mode' : ' text-mode'
      }`}
    >
      {isWord && (documentUrl || requirementId) ? (
        <RequirementDocxPreview
          requirementId={requirementId}
          documentUrl={documentUrl}
          previewUrl={previewUrl}
          documentName={documentName}
        />
      ) : !isWord && documentUrl ? (
        <RequirementTextPreview previewUrl={previewUrl} />
      ) : (
        <div className="requirement-document-text-host">
          <div className="requirement-document-text-article">暂无源文件</div>
        </div>
      )}
    </div>
  )

  const analysisResultContent = understandingResult ? (
    <div className="requirement-document-understanding">
      <pre className="requirement-document-understanding-content">{understandingResult}</pre>
    </div>
  ) : (
    <div className="requirement-document-understanding-empty">
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无增强文本" />
    </div>
  )

  return (
    <div className={`requirement-document-modal${embedded ? ' requirement-document-inline' : ''}`}>
      <div className="requirement-document-modal-toolbar">
        <div className="requirement-document-modal-toolbar-main">
          <div className="requirement-document-modal-title">需求文档</div>
          <div className="requirement-document-modal-meta">
            <span className="requirement-document-type-chip">{documentTypeLabel}</span>
            <span className="requirement-document-file-name" title={documentName}>
              {documentName}
            </span>
          </div>
        </div>
        {documentUrl || requirementId ? (
          <Button
            type="link"
            className="requirement-document-download-link"
            loading={downloadMutation.isPending}
            onClick={handleDownload}
          >
            <DownloadOutlined />
            下载原文件
          </Button>
        ) : null}
      </div>
      {downloadMutation.error ? <Alert showIcon type="error" title={getErrorMessage(downloadMutation.error)} /> : null}
      <Tabs
        className="requirement-document-tabs"
        defaultActiveKey="document"
        items={[
          {
            key: 'document',
            label: '需求文档',
            children: documentPreviewContent,
          },
          {
            key: 'analysis',
            label: '增强文本',
            children: analysisResultContent,
          },
        ]}
      />
    </div>
  )
}

export function RequirementDocumentPreviewModal({
  open,
  onClose,
  requirementId,
  requirementName,
  documentType,
  documentContent,
  documentFilename,
  documentDownloadUrl,
}: RequirementDocumentPreviewModalProps) {
  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(1180px, calc(100vw - 56px))"
      centered
      destroyOnHidden
      className="requirement-document-dialog"
    >
      <RequirementDocumentPreviewContent
        requirementId={requirementId}
        requirementName={requirementName}
        documentType={documentType}
        documentContent={documentContent}
        documentFilename={documentFilename}
        documentDownloadUrl={documentDownloadUrl}
      />
    </Modal>
  )
}
