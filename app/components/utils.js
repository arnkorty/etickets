import React from 'react'
import { Button } from 'antd'

const getColumnsConfig = self => ({
  rowKey: 'username',
  columns: [
    {
      title: '账号名',
      dataIndex: 'username'
    },
    {
      title: '密码',
      dataIndex: 'password'
    },
    {
      title: '状态',
      dataIndex: 'statusText',
      render: (text, row) => {
        return {
          props: {
            id: `status-${row.username}`
          },
          children: text
        }
      }
    },
    {
      title: '操作',
      dataIndex: 'actions',
      render: (_, row) => {
        return [
          <Button onClick={() => self.handleEdit(row)} size="small" style={{marginRight: 8}}>编辑</Button>,
          <Button onClick={() => self.handleLogin(row)} size="small" style={{marginRight: 8}}>登录</Button>,
          <Button onClick={() => self.handleBuy(row)} size="small" style={{marginRight: 8}}>购买</Button>,
          <Button onClick={() => self.handleDelete(row)} size="small" type="danger">删除</Button>,
        ]
      }
    }
  ]
});

export default {
  getColumnsConfig
};
