import { UploadOutlined } from '@ant-design/icons'
import { Alert, Button, Drawer, Form, Input, Select, Upload, message } from 'antd'
import type { FormInstance, UploadFile } from 'antd'
import { useEffect, useState } from 'react'
import type { CreateFunctionalCaseGenerateTaskPayload, FunctionalCaseGenerateTaskSourceType } from '../types'
import { getErrorMessage } from '@/utils/format'

export type FunctionalCaseGenerateTaskFormValues = CreateFunctionalCaseGenerateTaskPayload & {
  sourceFileName?: string
}

const sourceTypeOptions: Array<{ label: string; value: FunctionalCaseGenerateTaskSourceType }> = [
  { label: 'Text', value: 'text' },
  { label: 'DOCX', value: 'docx' },
]

function getAcceptBySourceType(sourceType?: FunctionalCaseGenerateTaskSourceType) {
  if (sourceType === 'docx') return '.docx'
  return ''
}

function isValidSourceFile(fileName: string, sourceType?: FunctionalCaseGenerateTaskSourceType) {
  if (sourceType === 'docx') return /\.docx$/i.test(fileName.trim())
  return true
}

function getDisplayFileName(sourceContent?: string, sourceFileName?: string) {
  if (sourceFileName) return sourceFileName
  if (!sourceContent) return ''

  const normalized = sourceContent.replace(/^uploaded-file:\/\//, '').split('?')[0]
  const segments = normalized.split(/[\\/]/)
  return segments[segments.length - 1] || normalized
}

export function FunctionalCaseGenerateTaskDrawer({
  title,
  open,
  form,
  editing,
  loading,
  error,
  sprintOptions,
  requirementOptions,
  onSprintChange,
  onClose,
  onFinish,
}: {
  title: string
  open: boolean
  form: FormInstance<FunctionalCaseGenerateTaskFormValues>
  editing: boolean
  loading: boolean
  error: unknown
  sprintOptions: Array<{ label: string; value: string }>
  requirementOptions: Array<{ label: string; value: string }>
  onSprintChange: (value?: string) => void
  onClose: () => void
  onFinish: (values: FunctionalCaseGenerateTaskFormValues) => void
}) {
  const sourceType = Form.useWatch('sourceType', form) ?? 'text'
  const sourceContentValue = Form.useWatch('sourceContent', form)
  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined)
  const [fileList, setFileList] = useState<UploadFile[]>([])

  useEffect(() => {
    if (!open) return
    setSelectedFile(undefined)
    const currentSourceType = form.getFieldValue('sourceType') as FunctionalCaseGenerateTaskSourceType | undefined
    const currentSourceContent = form.getFieldValue('sourceContent') as string | undefined
    const currentSourceFileName = form.getFieldValue('sourceFileName') as string | undefined

    if (currentSourceType !== 'text' && currentSourceContent) {
      const displayName = getDisplayFileName(currentSourceContent, currentSourceFileName)
      setFileList(
        displayName
          ? [
              {
                uid: 'existing-file',
                name: displayName,
                status: 'done',
              },
            ]
          : [],
      )
      return
    }

    setFileList([])
  }, [form, open])

  return (
    <Drawer
      title={title}
      open={open}
      onClose={onClose}
      width={640}
      rootClassName="ai-task-generate-drawer"
      destroyOnClose={false}
      extra={
        <Button type="primary" className="action-btn-save" loading={loading} onClick={() => form.submit()}>
          保存
        </Button>
      }
    >
      {error ? <Alert showIcon type="error" message={getErrorMessage(error)} style={{ marginBottom: 16 }} /> : null}
      <Form<FunctionalCaseGenerateTaskFormValues>
        className="ai-task-drawer-form"
        form={form}
        layout="vertical"
        onFinish={(values) => {
          if (values.sourceType === 'text') {
            onFinish({
              ...values,
              sourceContent: values.sourceContent?.trim() ?? '',
              file: undefined,
            })
            return
          }

          onFinish({
            ...values,
            sourceContent: selectedFile ? undefined : values.sourceContent,
            file: selectedFile,
          })
        }}
        requiredMark={false}
      >
        <Form.Item name="sourceFileName" hidden>
          <Input />
        </Form.Item>

        <div className="ai-task-drawer-basic-grid">
          <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
            <Input maxLength={120} placeholder="例如：订单审批功能用例生成" />
          </Form.Item>
          <Form.Item name="sprintId" label="所属迭代" rules={[{ required: true, message: '请选择所属迭代' }]}>
            <Select placeholder="请选择迭代" options={sprintOptions} onChange={onSprintChange} />
          </Form.Item>
          <Form.Item name="requirementId" label="所属需求" rules={[{ required: true, message: '请选择所属需求' }]}>
            <Select placeholder="请选择需求" options={requirementOptions} disabled={requirementOptions.length === 0} />
          </Form.Item>
          <Form.Item name="sourceType" label="来源类型" rules={[{ required: true, message: '请选择来源类型' }]}>
            <Select
              placeholder="请选择来源类型"
              options={sourceTypeOptions}
              onChange={(value: FunctionalCaseGenerateTaskSourceType) => {
                form.setFieldValue('sourceType', value)
                form.setFieldValue('sourceContent', '')
                form.setFieldValue('sourceFileName', undefined)
                setSelectedFile(undefined)
                setFileList([])
              }}
            />
          </Form.Item>
        </div>

        <Form.Item
          name="sourceContent"
          label="来源内容"
          extra={sourceType === 'text' ? '直接输入功能说明、业务规则或测试范围。' : undefined}
          rules={[
            {
              validator: async (_, value) => {
                if (sourceType === 'text') {
                  if (value && String(value).trim()) return
                  throw new Error('请输入来源内容')
                }

                if (selectedFile || (editing && value)) return
                throw new Error('请上传来源文件')
              },
            },
          ]}
        >
          {sourceType === 'text' ? (
            <Input.TextArea
              className="ai-task-source-textarea"
              maxLength={4000}
              placeholder="例如：请根据订单创建、审批、驳回、撤回和通知链路生成完整功能测试用例"
            />
          ) : (
            <div className="ai-task-source-upload-box">
              <Upload.Dragger
                accept={getAcceptBySourceType(sourceType)}
                maxCount={1}
                fileList={fileList}
                showUploadList={{ showPreviewIcon: false }}
                beforeUpload={(file) => {
                  if (!isValidSourceFile(file.name, sourceType)) {
                    message.error('仅支持 .docx 文件')
                    return Upload.LIST_IGNORE
                  }

                  const fileName = file.name.trim()
                  if (!editing) {
                    form.setFieldValue('sourceContent', '')
                  }
                  form.setFieldValue('sourceFileName', fileName)
                  setSelectedFile(file)
                  setFileList([
                    {
                      uid: `${Date.now()}`,
                      name: fileName,
                      status: 'done',
                      originFileObj: file,
                    },
                  ])
                  void form.validateFields(['sourceContent'])
                  message.success(`已选择文件：${fileName}`)
                  return false
                }}
                onRemove={() => {
                  form.setFieldValue('sourceContent', '')
                  form.setFieldValue('sourceFileName', undefined)
                  setSelectedFile(undefined)
                  setFileList([])
                  void form.validateFields(['sourceContent'])
                  return true
                }}
              >
                <p className="ant-upload-drag-icon">
                  <UploadOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽 DOCX 文件到这里</p>
              </Upload.Dragger>
              {editing && !selectedFile && sourceContentValue ? (
                <div style={{ marginTop: 4, color: 'var(--ai-text-secondary, #97a3ba)', fontSize: 12 }}>
                  未重新上传文件时，将保留后端已有文件路径。
                </div>
              ) : null}
            </div>
          )}
        </Form.Item>

        <Form.Item
          name="instruction"
          label="生成指令"
          extra="描述希望生成的业务范围、场景颗粒度或输出约束。"
        >
          <Input.TextArea className="ai-task-instruction-textarea" maxLength={1000} placeholder="例如：按主流程、异常流程和边界校验分组输出功能测试用例" />
        </Form.Item>
      </Form>
    </Drawer>
  )
}
