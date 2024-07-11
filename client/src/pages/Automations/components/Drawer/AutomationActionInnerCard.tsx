import { TablerSquareNumber2Filled } from '@/components/Icons/CustomIcons';
import AutomationActionTitle from '@/pages/Automations/components/Drawer/AutomationActionTitle';
import DockerActionSubForm from '@/pages/Automations/components/Drawer/DockerActionSubForm';
import PlaybookActionSubForm from '@/pages/Automations/components/Drawer/PlaybookActionSubForm';
import {
  CheckCircleFilled,
  DockerOutlined,
  PlaySquareOutlined,
} from '@ant-design/icons';
import { ProFormDependency, ProFormSelect } from '@ant-design/pro-components';
import { Card, Space } from 'antd';
import { FormInstance } from 'antd/lib';
import React from 'react';
import { Automations } from 'ssm-shared-lib';

const options = [
  {
    label: 'Playbook',
    value: Automations.Actions.PLAYBOOK,
    icon: <PlaySquareOutlined />,
  },
  {
    label: 'Docker Action',
    value: Automations.Actions.DOCKER,
    icon: <DockerOutlined />,
  },
];

type AutomationActionProps = {
  setOverrideExtraVars: any;
  overrideExtraVars: any;
  formRef: FormInstance<any>;
};

const AutomationActionInnerCard: React.FC<AutomationActionProps> = (props) => {
  return (
    <Card
      type="inner"
      title={
        <AutomationActionTitle
          title={'Execute'}
          icon={
            <TablerSquareNumber2Filled
              style={{ width: '1.8em', height: '1.8em', marginTop: 6 }}
            />
          }
        />
      }
    >
      <ProFormSelect
        rules={[
          {
            required: true,
          },
        ]}
        width="xl"
        name="action"
        options={options}
        fieldProps={{
          menuItemSelectedIcon: <CheckCircleFilled />,
          labelRender: (props) => (
            <Space>
              <span role="img" aria-label={props.label as string}>
                {options.find((option) => option.value === props.value)?.icon}{' '}
              </span>
              {props.label}
            </Space>
          ),
          optionRender: (option) => (
            <Space>
              <span role="img" aria-label={option.data.label as string}>
                {option.data.icon}
              </span>
              {option.data.label}
            </Space>
          ),
        }}
        placeholder="Type of action"
      />
      <ProFormDependency name={['action']}>
        {({ action }) => {
          if (action === Automations.Actions.PLAYBOOK) {
            return (
              <PlaybookActionSubForm
                overrideExtraVars={props.overrideExtraVars}
                setOverrideExtraVars={props.setOverrideExtraVars}
                formRef={props.formRef}
              />
            );
          }
          if (action === Automations.Actions.DOCKER) {
            return <DockerActionSubForm />;
          }
        }}
      </ProFormDependency>
    </Card>
  );
};

export default AutomationActionInnerCard;