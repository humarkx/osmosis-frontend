import { KVStore } from '@keplr-wallet/common';
import { ChainGetter, ObservableChainQuery, ObservableChainQueryMap } from '@keplr-wallet/stores';
import { SuperfluidDelegationsResponse, SuperfluidDelegationRecordsResponse, SuperfluidDelegation } from './types';
import { makeObservable } from 'mobx';
import { CoinPretty, Dec } from '@keplr-wallet/unit';
import { Currency } from '@keplr-wallet/types';
import { computedFn } from 'mobx-utils';

export class ObservableQuerySuperfluidDelegationsInner extends ObservableChainQuery<SuperfluidDelegationsResponse> {
	constructor(
		kvStore: KVStore,
		chainId: string,
		chainGetter: ChainGetter,
		protected readonly delegatorBech32Address: string
	) {
		super(
			kvStore,
			chainId,
			chainGetter,
			`/osmosis/superfluid/v1beta1/superfluid_delegations/${delegatorBech32Address}`
		);

		makeObservable(this);
	}

	readonly getDelegations = computedFn((poolShareCurrency: Currency): SuperfluidDelegation[] | undefined => {
		if (!this.response) {
			return undefined;
		}

		const validatorCombinedDelegationRecordMap = this.response.data.superfluid_delegation_records.reduce(
			(delecationRecordMap, delegationRecord) => {
				const combiningDelegationRecord = delecationRecordMap.get(delegationRecord.validator_address);

				if (combiningDelegationRecord) {
					const combinedDelegationAmount = new Dec(combiningDelegationRecord.delegation_amount.amount).add(
						new Dec(delegationRecord.delegation_amount.amount)
					);

					delecationRecordMap.set(delegationRecord.validator_address, {
						...delegationRecord,
						delegation_amount: {
							...combiningDelegationRecord.delegation_amount,
							amount: combinedDelegationAmount.toString(),
						},
					});
				} else {
					delecationRecordMap.set(delegationRecord.validator_address, delegationRecord);
				}

				return delecationRecordMap;
			},
			new Map<string, SuperfluidDelegationRecordsResponse>()
		);

		const validatorCombinedDelegationRecords = [...validatorCombinedDelegationRecordMap.values()];

		return validatorCombinedDelegationRecords.map(record => ({
			delegator_address: record.delegator_address,
			validator_address: record.validator_address,
			amount: new CoinPretty(poolShareCurrency, new Dec(record.delegation_amount.amount)),
		}));
	});
}

export class ObservableQuerySuperfluidDelegations extends ObservableChainQueryMap<SuperfluidDelegationsResponse> {
	constructor(
		protected readonly kvStore: KVStore,
		protected readonly chainId: string,
		protected readonly chainGetter: ChainGetter
	) {
		super(kvStore, chainId, chainGetter, delegatorBech32Address => {
			return new ObservableQuerySuperfluidDelegationsInner(
				this.kvStore,
				this.chainId,
				this.chainGetter,
				delegatorBech32Address
			);
		});
	}

	getQuerySuperfluidDelegations(delegatorBech32Address: string): ObservableQuerySuperfluidDelegationsInner {
		return this.get(delegatorBech32Address) as ObservableQuerySuperfluidDelegationsInner;
	}
}