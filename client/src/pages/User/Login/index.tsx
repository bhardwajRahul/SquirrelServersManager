// @ts-ignore
import loginBackground from '@/pages/User/Login/assets/background.png';
import { hasUser, user } from '@/services/rest/users/users';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import {
  LoginFormPage,
  ProConfigProvider,
  ProFormCheckbox,
  ProFormText,
} from '@ant-design/pro-components';
import { history, useModel } from '@umijs/max';
import message from '@/components/Message/DynamicMessage';
import { Divider } from 'antd';
import React from 'react';
import { flushSync } from 'react-dom';
import { API } from 'ssm-shared-lib';

const Login: React.FC = () => {
  const { initialState, setInitialState } = useModel('@@initialState');
  const fetchUserInfo = async () => {
    const userInfo = await initialState?.fetchUserInfo?.();
    if (userInfo) {
      flushSync(() => {
        setInitialState((s: any) => ({
          ...s,
          currentUser: userInfo,
        }));
      });
    }
  };

  const checkIfFirstTime = async () => {
    await hasUser().then((e) => {
      if (!e.data.hasUsers) {
        history.push('/user/onboarding');
      }
    });
  };
  checkIfFirstTime();

  const handleSubmit = async (values: API.LoginParams) => {
    try {
      const res = await user({ ...values });
      if (res.success) {
        const defaultLoginSuccessMessage = 'Success！';
        message.success({ content: defaultLoginSuccessMessage, duration: 6 });
        await fetchUserInfo();
        const urlParams = new URL(window.location.href).searchParams;
        history.push(urlParams.get('redirect') || '/');
        return;
      }
    } catch (error) {
      const defaultLoginFailureMessage = 'Login failed！';
      message.error({ content: defaultLoginFailureMessage, duration: 6 });
    }
  };

  return (
    <ProConfigProvider dark>
      <div
        style={{
          backgroundColor: 'white',
          height: '100vh',
        }}
      >
        <LoginFormPage
          backgroundImageUrl={loginBackground}
          logo={<img alt="logo" src="/logo.svg" />}
          containerStyle={{
            backgroundColor: 'rgba(0, 0, 0,0.65)',
            backdropFilter: 'blur(4px)',
          }}
          title="Squirrel Servers Manager"
          subTitle="All in one place"
          initialValues={{
            autoLogin: true,
          }}
          submitter={{
            searchConfig: {
              submitText: 'Login', //直接配就好啦
            },
          }}
          onFinish={async (values) => {
            await handleSubmit(values as API.LoginParams);
          }}
          actions={
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexDirection: 'column',
              }}
            >
              <Divider plain>
                <span
                  style={{
                    // color: token.colorTextPlaceholder,
                    fontWeight: 'normal',
                    fontSize: 14,
                  }}
                >
                  AGPL-3.0 license
                </span>
              </Divider>
            </div>
          }
        >
          <>
            <ProFormText
              name="username"
              fieldProps={{
                size: 'large',
                prefix: (
                  <UserOutlined
                    style={
                      {
                        //  color: token.colorText,
                      }
                    }
                    className={'prefixIcon'}
                  />
                ),
              }}
              placeholder={'email'}
              rules={[
                {
                  required: true,
                  message: 'Please input your username!',
                },
              ]}
            />
            <ProFormText.Password
              name="password"
              fieldProps={{
                size: 'large',
                prefix: (
                  <LockOutlined
                    style={
                      {
                        //  color: token.colorText,
                      }
                    }
                    className={'prefixIcon'}
                  />
                ),
              }}
              placeholder={'password'}
              rules={[
                {
                  required: true,
                  message: 'Password required',
                },
              ]}
            />
          </>

          <div
            style={{
              marginBottom: 24,
            }}
          >
            <ProFormCheckbox noStyle name="autoLogin">
              Remember me
            </ProFormCheckbox>
            <a
              style={{
                float: 'right',
              }}
            >
              Forgot Password ?
            </a>
          </div>
        </LoginFormPage>
      </div>
    </ProConfigProvider>
  );
};

export default Login;
