/**
 * Created by denisgranha on 1/4/16.
 */
import event from './eventFactory';
import gnosis from '../src';
import {waitForReceipt} from '../src/lib/transactions';
import Web3 from 'web3';
import BigNumber from 'bignumber.js';

let times = (n) => {
    return (f, arg) => {
        return Array(n).fill().map((_, i) => f(arg));
    };
};

if (process.argv.length != 3){
    console.log("Please, provide the number of events you want to create\n");
}
else{
    console.log("Initializing\n");
    gnosis.config.initialize(
      {
          // Testrpc Configuration
          addresses: {
            // optional: Allows to do market operations without passing the market address
            defaultMarketFactory: '0x0634e653ee7cc2a01efca45a6b5365d7c2911f31',

            // optional: Allows calculating of share prices without passing the maker address
            defaultMarketMaker: '0x1912f977d4ed325f145644a7151f410aed75c85b',

            // obligatory
            etherToken: '0xd4762520d0bd6b4013fcd916a3b2995666eb3a4a',

            // obligatory
            eventFactory: '0x4f4c243aa1a7f9ffb12cec09d9d6cb8b0130a8ae',

            // optional
            ultimateOracle: '0xb7ead0f8e08594b0337d4332554962b69a201cfc',
            // optional
            lmsrMarketMaker: '0x1912f977d4ed325f145644a7151f410aed75c85b',

            marketSol: '0x0634e653ee7cc2a01efca45a6b5365d7c2911f31',

            hunchGameToken: '0x31fd8a27f4abdbb74ad92539948cd69ef9fb88a7',
            hunchGameMarketFactory: '0x1ec884fd25e73edd024153e5ced3051738c8fd63',
          },
          addressFiltersPostLoad: {
            marketMakers: ['0x1912f977d4ed325f145644a7151f410aed75c85b'],
            oracles: ['0xb7ead0f8e08594b0337d4332554962b69a201cfc'],
            tokens: ['0xd4762520d0bd6b4013fcd916a3b2995666eb3a4a', '0x31fd8a27f4abdbb74ad92539948cd69ef9fb88a7'],
          },

          addressFilters: {
            // optional: Only loads events from blockchain, which are resolved by
            // given oracle
            oracle: '0xb7ead0f8e08594b0337d4332554962b69a201cfc',
            // optional: Only loads markets from blockchain, which are created by
            // given investor
            investor: null,
          },
          gnosisServiceURL: 'http://127.0.0.1:8050/api/',
          ethereumNodeURL: 'http://127.0.0.1:8545',
          gethNode: false,
      }
    ).then((config) => {
        // We create n event objects where n passed as a command line argument
        let numEvents = Number(process.argv[2]);
        let events = times(numEvents)(event, config);
        console.log("Initialized\n");
        console.log("Creating events...\n");

        function processEvent(event){
          return new Promise((resolve, reject) => {
            gnosis.api.createEvent(
              event,
              config.account,
              config
            )
            .then((response) => {
                var identifiers = gnosis.helpers.getEventIdentifiers(event);
                gnosis.helpers.signOracleFee(
                  config.account,
                  identifiers.descriptionHash,
                  event.fee,
                  event.feeToken,
                  config
                )
                .then((feeData) => {
                  // Set by promise returned by createEventOnChain
                  let eventHash = null;
                  gnosis.contracts.eventFactory.createOffChainEvent(
                      event,
                      identifiers.descriptionHash,
                      [feeData],
                      config,
                      (e, receipt) =>
                      {
                        gnosis.contracts.etherToken.buyTokens(
                          new BigNumber('1e21'),
                          config,
                          function(e, receipt){
                            return gnosis.contracts.token.approve(
                                config.addresses.etherToken,
                                config.addresses.defaultMarketFactory,
                                new BigNumber('1e21'),
                                config,
                                (e, receipt) => {
                                // Create market
                                gnosis.contracts.marketFactory.createMarket(
                                    event.market,
                                    eventHash,
                                    config,
                                    null,
                                    (e, receipt) =>
                                    {
                                        resolve(event);
                                    }).catch(reject);
                                  });
                                });
                      }
                  ).then((result) =>
                  {
                      eventHash = result.simulatedResult;
                  }, reject);
                }, reject);
              }, reject);
          });
        }
        var promises = events.map(processEvent);

        Promise.all(promises).then((events) => {
            console.log("Created " + numEvents + " events succesfully both on API and blockchain\n");
            process.exit();
        },
          (error) => {
              console.error(error);
              process.abort();
          });
    },
    function(err){
        console.log(err);
    });

}
