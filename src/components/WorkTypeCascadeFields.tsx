import { Form, Input, Select } from "antd"
import type { FormInstance } from "antd"
import type {
  ConstructionDataState,
  EntityId,
  QuantityUnit,
} from "../domain/models"
import {
  defaultTaskTitle,
  getTemplateForWorkType,
  getTradesForStage,
  getWorkTypesForStageTrade,
} from "../domain/workLibrary"

interface CascadeValues {
  stageId?: EntityId
  tradeId?: EntityId
  workTypeId?: EntityId
  title?: string
  unit?: QuantityUnit
}

export default function WorkTypeCascadeFields({
  state,
  form,
  includeTitle = false,
}: {
  state: ConstructionDataState
  // Parent screens pass richer form value types that include these cascade fields.
  form: FormInstance
  includeTitle?: boolean
}) {
  const stageId = Form.useWatch("stageId", form)
  const tradeId = Form.useWatch("tradeId", form)
  const trades = getTradesForStage(state, stageId)
  const workTypes = getWorkTypesForStageTrade(state, stageId, tradeId)

  const applyWorkType = (workTypeId: EntityId) => {
    const workType = state.workTypes.find((item) => item.id === workTypeId)
    const template = getTemplateForWorkType(state, workTypeId)
    form.setFieldsValue({
      workTypeId,
      unit: template?.defaultUnit ?? workType?.defaultUnit,
      ...(includeTitle ? { title: defaultTaskTitle(state, workTypeId) } : {}),
    })
  }

  return (
    <>
      <Form.Item
        label="Stage"
        name="stageId"
        rules={[{ required: true, message: "Choose a construction stage" }]}
      >
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="e.g. RCC Structure"
          options={state.stages.map((stage) => ({
            value: stage.id,
            label: stage.name,
          }))}
          onChange={() => {
            form.setFieldsValue({
              tradeId: undefined,
              workTypeId: undefined,
              ...(includeTitle ? { title: undefined } : {}),
            })
          }}
        />
      </Form.Item>
      <Form.Item
        label="Trade"
        name="tradeId"
        rules={[{ required: true, message: "Choose a trade" }]}
      >
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="e.g. Reinforcement"
          disabled={!stageId}
          options={trades.map((trade) => ({
            value: trade.id,
            label: trade.name,
          }))}
          onChange={() => {
            form.setFieldsValue({
              workTypeId: undefined,
              ...(includeTitle ? { title: undefined } : {}),
            })
          }}
        />
      </Form.Item>
      <Form.Item
        label="Work type"
        name="workTypeId"
        rules={[{ required: true, message: "Choose a standard work type" }]}
      >
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="e.g. Column Reinforcement"
          disabled={!tradeId}
          options={workTypes.map((workType) => ({
            value: workType.id,
            label: workType.name,
          }))}
          onChange={(value) => applyWorkType(value)}
        />
      </Form.Item>
      {includeTitle ? (
        <Form.Item
          label="Task title"
          name="title"
          extra="Prefills from the library template. Override only if needed."
          rules={[{ required: true, message: "Task title is required" }]}
        >
          <Input placeholder="From work library template" />
        </Form.Item>
      ) : null}
    </>
  )
}
