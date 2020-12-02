const { validateCertificate } = require("../utils");
const { getCertificateArnByDomain } = require("../utils");
const { removeDomainFromCloudFrontDistribution } = require("../utils");
const { addDomainToCloudfrontDistribution } = require("../utils");
const { removeCloudFrontDomainDnsRecords } = require("../utils");
const { configureDnsForCloudFrontDistribution } = require("../utils");
const { createCertificate } = require("../utils");
const { describeCertificateByArn } = require("../utils");
const { getOutdatedDomains } = require("../utils");
const { getDomainHostedZoneId } = require("../utils");
const { prepareSubdomains } = require("../utils");

const {
  mockListHostedZonesByNamePromise,
  mockListHostedZonesByName,
  mockDescribeCertificate,
  mockDescribeCertificatePromise,
  mockRequestCertificate,
  mockRequestCertificatePromise,
  mockChangeResourceRecordSets,
  mockChangeResourceRecordSetsPromise,
  mockGetDistributionConfig,
  mockGetDistributionConfigPromise,
  mockUpdateDistributionPromise,
  mockListCertificatesPromise,
  mockListResourceRecordSetsPromise,
  CloudFront,
  Route53,
  ACM
} = require("aws-sdk");

jest.mock("aws-sdk", () => require("../__mocks__/aws-sdk.mock"));

const domain = "example.com";
const www = {
  id: "www",
  url: "www.example.com"
};
const important = {
  id: "important",
  url: "important.example.com"
};

const cf = {
  id: "cf:distr:id",
  url: "xxx.cloudfront.net"
};

const defaultInput = {
  domain,
  subdomains: {}
};

const noopContext = {
  debug: () => {}
};

describe("prepareSubdomains", () => {
  it("is empty when no subdomains passed", () => {
    const noSubdomains = defaultInput;
    const result = prepareSubdomains(noSubdomains);

    expect(result).toEqual([]);
  });

  it("adds all subdomains", () => {
    const result = prepareSubdomains({
      ...defaultInput,
      subdomains: {
        [www.id]: www,
        [important.id]: important,
        [cf.id]: cf
      }
    });

    // todo: rework... not quite clear
    expect(result).toEqual([
      {
        domain: "www.example.com"
      },
      {
        domain: "important.example.com"
      },
      {
        distributionId: "cf:distr:id",
        domain: "cf:distr:id.example.com",
        url: "xxx.cloudfront.net",
        type: "awsCloudFront"
      }
    ]);
  });
});

describe("getOutdatedDomains", () => {
  it("detects current domain with subdomains as outdated when domain changed", () => {
    const state = {
      domain: "example.com",
      subdomains: {
        domain: "www.example.com"
      }
    };

    const outdated = getOutdatedDomains(
      { domain: "newexample.com" },
      { domain: "example.com", subdomains: { domain: "www.example.com" } }
    );

    expect(outdated).toEqual(state);
  });

  it("breaks because code seems to be broken", () => {
    const state = {
      domain: "example.com",
      subdomains: [
        {
          domain: "www.example.com"
        }
      ]
    };

    const outdated = getOutdatedDomains(
      {
        domain: "example.com",
        subdomains: [
          {
            domain: "www2.example.com"
          }
        ]
      },
      state
    );
  });
});

describe("getDomainHostedZoneId", () => {
  it("finds the identifier for an existing zone", async () => {
    mockListHostedZonesByNamePromise.mockResolvedValueOnce({
      HostedZones: [
        {
          Id: "/hostedzone/Z02304331WODHTD1UV23Q",
          Name: "example.com.",
          Config: {
            PrivateZone: false
          }
        }
      ]
    });

    const route53 = new Route53();

    const zoneId = await getDomainHostedZoneId(route53, "example.com", false);

    expect(mockListHostedZonesByName).toHaveBeenCalledWith({
      DNSName: "example.com"
    });
    expect(zoneId).toEqual("Z02304331WODHTD1UV23Q");
  });

  it("filters zones by name and private flag", async () => {
    mockListHostedZonesByNamePromise.mockResolvedValueOnce({
      HostedZones: [
        {
          Id: "/hostedzone/Z02304331WODHTD1UV23Q",
          Name: "example.com.",
          Config: {
            PrivateZone: false
          }
        },
        {
          Id: "/hostedzone/Z9381JMNADKDU§JAJS98AJ",
          Name: "test.com.",
          Config: {
            PrivateZone: true
          }
        }
      ]
    });

    const route53 = new Route53();
    const zoneId = await getDomainHostedZoneId(route53, "test.com", true);

    expect(mockListHostedZonesByName).toHaveBeenCalledWith({
      DNSName: "test.com"
    });
    expect(zoneId).toEqual("Z9381JMNADKDU§JAJS98AJ");
  });

  it("throws when no zone for domain present", async () => {
    mockListHostedZonesByNamePromise.mockResolvedValueOnce({
      HostedZones: [
        {
          Id: "/hostedzone/Z02304331WODHTD1UV23Q",
          Name: "example.com.",
          Config: {
            PrivateZone: false
          }
        }
      ]
    });

    const route53 = new Route53();

    await expect(() =>
      getDomainHostedZoneId(route53, "test.com", false)
    ).rejects.toThrow("Domain test.com was not found in your AWS account");
  });
});

describe("describeCertificateByArn", () => {
  it("retrieves the certificate using acm", async () => {
    const certificate = {
      CertificateArn: "example:cert:arn",
      DomainName: "example.com"
    };

    mockDescribeCertificatePromise.mockResolvedValueOnce({
      Certificate: certificate
    });

    const acm = new ACM();

    const result = await describeCertificateByArn(
      acm,
      certificate.CertificateArn
    );

    expect(mockDescribeCertificate).toHaveBeenCalledWith({
      CertificateArn: certificate.CertificateArn
    });
    expect(result).toEqual(certificate);
  });

  it("returns null when acm response undefined", async () => {
    mockDescribeCertificatePromise.mockResolvedValueOnce(undefined);

    const acm = new ACM();

    const result = await describeCertificateByArn(acm, "example:cert:arn");

    expect(result).toBeNull();
  });

  it("returns null when certificate undefined", async () => {
    mockDescribeCertificatePromise.mockResolvedValueOnce({
      Certificate: undefined
    });

    const acm = new ACM();

    const result = await describeCertificateByArn(acm, "example:cert:arn");

    expect(result).toBeNull();
  });
});

describe("getCertificateArnByDomain", () => {
  it("xx", async () => {
    mockListCertificatesPromise.mockResolvedValueOnce({
      CertificateSummaryList: [
        {
          CertificateArn: "cert:arn:1",
          DomainName: "example.com"
        }
      ]
    });

    const acm = new ACM();

    const cert = await getCertificateArnByDomain(acm, "example.com");

    expect(cert).toEqual("cert:arn:1");
  });

  it("returns null when certificate not found", async () => {
    mockListCertificatesPromise.mockResolvedValueOnce({
      CertificateSummaryList: [
        {
          CertificateArn: "cert:arn:1",
          DomainName: "example.com"
        }
      ]
    });

    const acm = new ACM();

    const cert = await getCertificateArnByDomain(acm, "another.com");

    expect(cert).toBeNull();
  });

  it("support stuff", async () => {
    mockListCertificatesPromise.mockResolvedValueOnce({
      CertificateSummaryList: [
        {
          CertificateArn: "cert:arn:1",
          DomainName: "www.example.com"
        }
      ]
    });

    mockDescribeCertificatePromise.mockResolvedValueOnce({
      Certificate: {
        DomainValidationOptions: [
          {
            DomainName: "example.com"
          }
        ]
      }
    });

    const acm = new ACM();

    const cert = await getCertificateArnByDomain(acm, "www.example.com");

    expect(cert).toEqual("cert:arn:1");
  });

  it("should not find stuff", async () => {
    mockListCertificatesPromise.mockResolvedValueOnce({
      CertificateSummaryList: [
        {
          CertificateArn: "cert:arn:1",
          DomainName: "www.example.com"
        }
      ]
    });

    mockDescribeCertificatePromise.mockResolvedValueOnce({
      Certificate: {
        DomainValidationOptions: [
          {
            DomainName: "www2.example.com"
          }
        ]
      }
    });

    const acm = new ACM();

    const cert = await getCertificateArnByDomain(acm, "www.example.com");

    expect(cert).toEqual(null);
  });
});

describe("createCertificate", () => {
  it("creates the certificate", async () => {
    const arn = "example:arn";
    const req = {
      DomainName: "example.com",
      SubjectAlternativeNames: ["example.com", "*.example.com"],
      ValidationMethod: "DNS"
    };

    mockRequestCertificatePromise.mockResolvedValueOnce({
      CertificateArn: arn
    });

    const acm = new ACM();

    const result = await createCertificate(acm, "example.com");

    expect(mockRequestCertificate).toHaveBeenCalledWith(req);
    expect(result).toEqual(arn);
  });
});

describe("validateCertificate", () => {
  it("runs", async () => {
    const acm = new ACM();
    const route53 = new Route53();

    mockDescribeCertificatePromise.mockResolvedValue({
      Certificate: {
        Status: "ISSUED",
        DomainValidationOptions: [
          {
            DomainName: "example.com",
            ResourceRecord: {}
          }
        ]
      }
    });

    mockListResourceRecordSetsPromise.mockResolvedValueOnce({
      ResourceRecordSets: []
    });

    await validateCertificate(
      acm,
      route53,
      {
        CertificateArn: "arn:cert:1"
      },
      "example.com",
      "zone-id"
    );
  });
});

describe("configureDnsForCloudFrontDistribution", () => {
  it("runs2", async () => {
    const route53 = new Route53();
    const request = {
      HostedZoneId: "zone-id",
      ChangeBatch: {
        Changes: [
          {
            Action: "UPSERT",
            ResourceRecordSet: {
              Name: "example.com",
              Type: "A",
              AliasTarget: {
                HostedZoneId: "Z2FDTNDATAQYW2",
                DNSName: "distr.cloudfront.net",
                EvaluateTargetHealth: false
              }
            }
          }
        ]
      }
    };
    const result = await configureDnsForCloudFrontDistribution(
      route53,
      {
        domain: "www.example.com"
      },
      "zone-id",
      "distr.cloudfront.net",
      "apex",
      {
        debug: () => {}
      }
    );

    expect(mockChangeResourceRecordSets).toHaveBeenCalledWith(request);
  });

  it("runs", async () => {
    const route53 = new Route53();
    const request = {
      HostedZoneId: "zone-id",
      ChangeBatch: {
        Changes: [
          {
            Action: "UPSERT",
            ResourceRecordSet: {
              Name: "example.com",
              Type: "A",
              AliasTarget: {
                HostedZoneId: "Z2FDTNDATAQYW2",
                DNSName: "distr.cloudfront.net",
                EvaluateTargetHealth: false
              }
            }
          }
        ]
      }
    };
    const result = await configureDnsForCloudFrontDistribution(
      route53,
      {
        domain: "www.example.com"
      },
      "zone-id",
      "distr.cloudfront.net",
      "www",
      {
        debug: () => {}
      }
    );

    expect(mockChangeResourceRecordSets).toHaveBeenCalledWith(request);
  });
});

describe("removeCloudFrontDomainDnsRecords", () => {
  it("delete the record using the Route53 client", async () => {
    const request = {
      HostedZoneId: "zone-id",
      ChangeBatch: {
        Changes: [
          {
            Action: "DELETE",
            ResourceRecordSet: {
              Name: "example.com",
              Type: "A",
              AliasTarget: {
                HostedZoneId: "Z2FDTNDATAQYW2",
                DNSName: "xxx.cloudfront.net",
                EvaluateTargetHealth: false
              }
            }
          }
        ]
      }
    };

    const route53 = new Route53();

    await removeCloudFrontDomainDnsRecords(
      route53,
      "example.com",
      "zone-id",
      "xxx.cloudfront.net",
      {
        debug: () => {}
      }
    );

    expect(mockChangeResourceRecordSets).toHaveBeenCalledWith(request);
  });

  it("catches invalid change batch errors", async () => {
    const route53 = new Route53();

    mockChangeResourceRecordSetsPromise.mockRejectedValueOnce({
      code: "InvalidChangeBatch"
    });

    await removeCloudFrontDomainDnsRecords(
      route53,
      "example.com",
      "zone-id",
      "xxx.cloudfront.net",
      noopContext
    );
  });

  it("rethrows any other errors", async () => {
    const route53 = new Route53();

    mockChangeResourceRecordSetsPromise.mockRejectedValueOnce({
      code: "Another error"
    });

    expect(() =>
      removeCloudFrontDomainDnsRecords(
        route53,
        "example.com",
        "zone-id",
        "xxx.cloudfront.net",
        noopContext
      )
    ).rejects.toThrowError();
  });
});

describe("addDomainToCloudfrontDistribution", () => {
  it("t", async () => {
    mockUpdateDistributionPromise.mockResolvedValueOnce({
      Distribution: {
        Id: "",
        ARN: "",
        DomainName: ""
      }
    });
    mockGetDistributionConfigPromise.mockResolvedValueOnce({
      ETag: "etag",
      DistributionConfig: {
        Aliases: {}
      }
    });

    const cf = new CloudFront();

    await addDomainToCloudfrontDistribution(
      cf,
      {
        domain: "",
        distributionId: ""
      },
      "cert:arn",
      "apex",
      {
        viewerCertificate: {}
      },
      noopContext
    );
  });
});

describe("removeDomainFromCloudFrontDistribution", () => {
  it("x", async () => {
    mockGetDistributionConfigPromise.mockResolvedValueOnce({
      DistributionConfig: {
        Aliases: {}
      }
    });

    mockUpdateDistributionPromise.mockResolvedValueOnce({
      Distribution: {
        Id: "",
        ARN: "",
        DomainName: ""
      }
    });

    const cf = new CloudFront();

    await removeDomainFromCloudFrontDistribution(
      cf,
      {
        distributionId: "dist:id"
      },
      noopContext
    );
  });
});
