import React, { useState, useEffect } from 'react'
import _ from 'lodash'
import { useQuery, useMutation } from 'react-apollo'
import styled from '@emotion/styled/macro'
import { useTranslation, Trans } from 'react-i18next'

import { emptyAddress, hasValidReverseRecord } from '../utils/utils'

import { SET_NAME } from 'graphql/mutations'
import mq from 'mediaQuery'
import { useEditable } from './hooks'

import { GET_REVERSE_RECORD, GET_NAMES_FROM_SUBGRAPH } from 'graphql/queries'

import SaveCancel from './SingleName/SaveCancel'
import PendingTx from './PendingTx'

import { ReactComponent as DefaultCheck } from './Icons/Check.svg'
import RotatingSmallCaret from './Icons/RotatingSmallCaret'
import { decryptName, checkIsDecrypted } from '../api/labels'
import Select from 'react-select'
import Modal from './Modal/Modal'
import Bin from '../components/Forms/Bin'
import Gap from '../components/Utils/Gap'

const Loading = styled('span')`
  color: #adbbcd;
`

const Warning = styled(`div`)`
  color: #f5a623;
`

const AddReverseRecordContainer = styled('div')`
  background: #f0f6fa;
  border: 1px solid #ededed;
  border-radius: 8px;
  margin: 20px 30px 20px;
  padding: 10px 15px;

  ${mq.medium`
    margin: 20px 40px 20px;
  `}
`

const SetReverseContainer = styled('div')`
  margin-top: 15px;
  padding: 10px;
`

const ErrorMessage = styled('div')`
  font-weight: 300;
  font-size: 14px;
`

const Message = styled('div')`
  font-family: Overpass Mono;
  font-weight: 700;
  font-size: 14px;
  color: #adbbcd;
  letter-spacing: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;

  &:hover {
    cursor: pointer;
  }
`

const ReadOnlyMessage = styled(Message)`
  &:hover {
    cursor: default;
  }
`

const MessageContent = styled('div')`
  display: flex;
  align-items: center;
`

const IconStyles = () => `margin-right: 10px;
  flex-shrink: 0;
`

const Check = styled(DefaultCheck)`
  ${IconStyles()};
`

const Explanation = styled('div')`
  font-family: Overpass;
  font-weight: 300;
  font-size: 14px;
  color: #2b2b2b;
  letter-spacing: 0;
  line-height: 25px;
  margin-bottom: 10px;
  max-width: 768px;
  hyphens: auto;
`

const EditableNotSet = styled('div')`
  color: #5384fe;
`

const ButtonsContainer = styled('div')`
  display: flex;
  flex-direction: row-reverse;
  justify-content: space-between;
  align-items: center;
`

function AddReverseRecord({ account, currentAddress }) {
  const { t } = useTranslation()
  const { state, actions } = useEditable()
  const [newName, setNewName] = useState('')
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  const { editing, txHash, pending, confirmed } = state

  const { startEditing, stopEditing, startPending, setConfirmed } = actions
  let options

  const { data: { getReverseRecord } = {}, loading, refetch } = useQuery(
    GET_REVERSE_RECORD,
    {
      variables: {
        address: currentAddress
      }
    }
  )

  const [setName, { data }] = useMutation(SET_NAME, {
    onCompleted: data => {
      startPending(Object.values(data)[0])
    }
  })

  useEffect(() => {
    if (account && !getReverseRecord) {
      startEditing()
    }
  }, [getReverseRecord, account])
  const { data: { resolvers } = {} } = useQuery(GET_NAMES_FROM_SUBGRAPH, {
    variables: {
      address: currentAddress
    }
  })

  const isAccountMatched =
    account &&
    currentAddress &&
    account.toLowerCase() === currentAddress.toLowerCase()

  if (resolvers) {
    options = _.uniq(
      resolvers
        .map(r => {
          if (checkIsDecrypted(r?.domain?.name)) {
            return r?.domain?.name
          } else {
            let decrypted = decryptName(r.domain.name)
            // Ignore if label is not found
            if (checkIsDecrypted(decrypted)) {
              return decrypted
            } else {
              return null
            }
          }
        })
        .filter(r => !!r)
        .sort()
    ).map(r => {
      return { value: r, label: r }
    })
  }

  function handleSelect(e) {
    if (e && e.label) {
      setNewName(e)
    } else {
      setNewName('')
    }
  }

  function ReverseRecordEditor() {
    return (
      <>
        <Message onClick={editing ? stopEditing : startEditing}>
          {hasValidReverseRecord(getReverseRecord) ? (
            <MessageContent data-testid="editable-reverse-record-set">
              <Check />
              {t('singleName.record.messages.setTo') + getReverseRecord.name}
            </MessageContent>
          ) : (
            <EditableNotSet data-testid="editable-reverse-record-not-set">
              {t('singleName.record.messages.notSet')}
            </EditableNotSet>
          )}
          {pending && !confirmed && txHash ? (
            <PendingTx
              txHash={txHash}
              onConfirmed={() => {
                setConfirmed()
                refetch()
              }}
            />
          ) : (
            <RotatingSmallCaret rotated={editing} testid="open-reverse" />
          )}
        </Message>
        {editing && (
          <SetReverseContainer>
            <Explanation>
              <Trans i18nKey="singleName.record.messages.explanation">
                The Reverse Resolution translates an address into a name. It
                allows Dapps to show in their interfaces '
                {{
                  name:
                    (hasValidReverseRecord(getReverseRecord) &&
                      getReverseRecord.name) ||
                    'example.eth'
                }}
                ' rather than the long address '{{ account }}'. If you would
                like to set up your reverse for a different account, please
                switch accounts in your dapp browser.
              </Trans>
            </Explanation>
            {options?.length > 0 ? (
              <Select
                placeholder={t('singleName.record.messages.selectPlaceholder')}
                isClearable={true}
                value={newName}
                onChange={handleSelect}
                options={options}
              />
            ) : (
              <Warning>
                {t('singleName.record.messages.noForwardRecordAavilable')}
              </Warning>
            )}
            <Explanation>
              <p>
                <Trans i18nKey="singleName.record.messages.explanation2">
                  You can only select names you set this Ethereum Address as.
                </Trans>
              </p>
            </Explanation>
            <ButtonsContainer>
              <SaveCancel
                mutation={() => {
                  setName({ variables: { name: newName?.value } })
                }}
                stopEditing={stopEditing}
                isValid={!!newName}
              />
              {hasValidReverseRecord(getReverseRecord) && (
                <>
                  <Bin onClick={() => setIsDeleteModalOpen(true)} />
                  {isDeleteModalOpen && (
                    <Modal closeModal={() => setIsDeleteModalOpen(false)}>
                      {t('singleName.record.messages.reverseRecordRemoval')}
                      <Gap size={5} />
                      <SaveCancel
                        mutation={() => {
                          setName({ variables: { name: emptyAddress } })
                          setIsDeleteModalOpen(false)
                        }}
                        stopEditing={e => {
                          stopEditing(e)
                          setIsDeleteModalOpen(false)
                        }}
                        isValid
                      />
                    </Modal>
                  )}
                </>
              )}
            </ButtonsContainer>
          </SetReverseContainer>
        )}
      </>
    )
  }

  return (
    <AddReverseRecordContainer>
      {loading ? (
        <Loading>Loading reverse record...</Loading>
      ) : (
        <>
          {isAccountMatched ? (
            <ReverseRecordEditor />
          ) : (
            <ReadOnlyMessage>
              {hasValidReverseRecord(getReverseRecord) ? (
                <MessageContent data-testid="readonly-reverse-record-set">
                  {t('singleName.record.messages.setTo') +
                    getReverseRecord.name}
                </MessageContent>
              ) : (
                <div data-testid="readonly-reverse-record-not-set">
                  {t('singleName.record.messages.notSet')}
                </div>
              )}
            </ReadOnlyMessage>
          )}
        </>
      )}
    </AddReverseRecordContainer>
  )
}

export default AddReverseRecord
