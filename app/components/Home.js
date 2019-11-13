// @flow
import React, { Component } from 'react';
// import { Link } from 'react-router-dom';
import { Form, Table, Button, Input, Icon, Switch, Modal, message } from 'antd';
import utils from './utils'
// import routes from '../constants/routes';
import styles from './Home.css';
type Props = {};

class Home extends Component<Props> {
  props: Props;

  state = {
    buyChecked: false,
    username: '',
    batchVisibleModal: false,
    batchValue: '',
    editData: {},
    selectedRowKeys: [],
    editVisibleModal: false
  }

  getData = () => {
    const { accounts = [] } = this.props
    const { username, buyChecked} = this.state
    return accounts.filter(acc => {
      if (username && !acc.username.includes(username)) {
        return false
      }
      if (buyChecked && !acc.isSuccess) {
        return false
      }
      return true
    })
  }

  handleBuyCheckedChange = (v) => {
    this.setState({
      buyChecked: !this.state.buyChecked
    })
  }

  handleBatchAdd = () => {
    this.setState({
      batchVisibleModal: true
    })
  }

  handleEdit = (row) => {
    this.setState({
      editData: {
        ...row
      },
      editVisibleModal: true
    })
  }

  handleLogin = (row) => {

  }

  handleDelete = (row) => {
    Modal.confirm({
      title: '确认删除',
      onOk: () => {
        this.props.deleteAccount({...row})
      }
    })
  }

  handleBuy = (row) => {

  }

  onBatchAdd = () => {
    const { batchValue } = this.state
    if (batchValue.trim().length === 0) {
      message.warn('没有所要添加的账号')
      return
    }
    const data = batchValue.split("\n").filter(l => l.trim().split(/\s|\,| /).length === 2).map(l => {
      const [username, password] = l.trim().split(/\s|\,| /)
      return {
        username, password
      }
    })
    const { addBatchAccount } = this.props
    addBatchAccount(data)
    this.setState({
      batchVisibleModal: false,
      batchValue: ''
    })
  }

  onUpdate = () => {
    const { editData } = this.state
    const { updateAccount } = this.props
    updateAccount(editData)
    this.setState({
      editVisibleModal: false
    })
  }

  onSelectChange = selectedRowKeys => {
    this.setState({
      selectedRowKeys
    });
  };

  renderBatchModal = () => {
    const { batchVisibleModal, batchValue } = this.state
    return (
      <Modal
        title="批量添加账号"
        okText="确认添加"
        cancelText="取消"
        visible={batchVisibleModal}
        onCancel={() => {
          this.setState({
            batchVisibleModal: false,
          })
        }}
        onOk={this.onBatchAdd}
      >

        <Input.TextArea value={batchValue} onChange={(e) => {
          this.setState({
            batchValue: e.target.value
          })
        }} placeholder={`账号 密码\n账号 密码`} rows={10}/>

      </Modal>
    )
  }

  renderEditModal = () => {
    const { editData: {username, password}, editVisibleModal} = this.state
    return (
      <Modal
        title="更新账号"
        okText="确认"
        cancelText="取消"
        visible={editVisibleModal}
        onCancel={() => {
          this.setState({
            editVisibleModal: false
          })
        }}
        onOk={this.onUpdate}
      >
        <Form>
          <Form.Item label="账号">
            <Input value={username} onChange={(e) => {
              this.setState({
                editData: {
                  ...this.state.editData,
                  username: e.target.value
                }
              })
            }} placeholder={`账号`}/>
          </Form.Item>
          <Form.Item label="密码">
            <Input value={password} onChange={(e) => {
              this.setState({
                editData: {
                  ...this.state.editData,
                  password: e.target.value
                }
              })
            }} placeholder={`密码`}/>
          </Form.Item>
        </Form>

      </Modal>
    )
  }

  render() {
    // console.log('....f.ds.fsdf', this.props)
    const { username,selectedRowKeys } = this.state
    const rowSelection = {
      selectedRowKeys,
      onChange: this.onSelectChange,
    };
    const hasSelected = selectedRowKeys.length > 0;
    return (
      <div className={styles.container}>
        <div>
          <Form layout="inline">
            <Form.Item label="账号">
              <Input
                value={username}
                onChange={(e) => this.setState({username: e.target.value})}
                prefix={<Icon type="user" style={{ color: 'rgba(0,0,0,.25)' }} />}
              />
            </Form.Item>
            <Form.Item label="是否购买成功">
              <Switch checked={this.state.buyChecked} onChange={this.handleBuyCheckedChange} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" onClick={this.handleBatchAdd}>批量添加账号</Button>
            </Form.Item>
          </Form>
          {
            this.renderBatchModal()
          }
          {
            this.renderEditModal()
          }
        </div>
        <div className={styles.tableContainer}>
          <div style={{ marginBottom: 16 }}>
          <Button type="primary" style={{marginRight: 10}} onClick={this.handleBatchLogin} disabled={!hasSelected}>
            登录
          </Button>
          <Button type="primary" style={{marginRight: 10}} onClick={this.handleBatchBuy} disabled={!hasSelected}>
            购买
          </Button>
          <span style={{ marginLeft: 8 }}>
            {hasSelected ? `已选 ${selectedRowKeys.length} 个账号` : ''}
          </span>
        </div>
          <Table
            pagination={false}
            rowSelection={rowSelection}
            dataSource={this.getData()}
            {
              ...utils.getColumnsConfig(this)
            }
           />
        </div>
      </div>
    );
  }
}

export default Home
