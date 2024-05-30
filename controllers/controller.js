import axios from "axios";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import userModel from "../models/user.model.js";
import aws from "aws-sdk";
import { config } from "dotenv";
config();

aws.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION,
});
const route53 = new aws.Route53();

export async function register(req, res) {
  try {
    const { email, password, username, fname, lname } = req.body;
    console.log(req.body);

    const usernameFound = await userModel.findOne({
      username: username,
    });
    const emailFound = await userModel.findOne({
      email: email,
    });

    if (usernameFound) {
      return res.status(400).send({
        msg: "Username already in use!!!",
      });
    }

    if (emailFound) {
      return res.status(400).send({
        msg: "Email already registered!!!",
      });
    }

    await bcrypt.hash(password, 12).then(async (hashedPassword) => {
      const newUser = new userModel({
        fname,
        lname,
        email,
        password: hashedPassword,
        username,
      });

      try {
        const savedUser = await newUser.save();

        const token = jwt.sign(
          {
            userID: savedUser._id,
            username: savedUser.username,
            email: savedUser.email,
          },
          process.env.JWTSECRET,
          { expiresIn: "5h" }
        );

        return res.status(200).send({
          msg: "User created successfully",
          token,
        });
      } catch (error) {
        console.log(error);
        return res.status(500).send({
          msg: "Error creating user",
          error,
        });
      }
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      msg: err.message,
      error: err,
    });
  }
}

export async function login(req, res) {
  const { email, username, password } = req.body;
  console.log(req.body);
  let user;
  if (email) {
    user = await userModel.findOne({ email: email });
  } else if (username) {
    user = await userModel.findOne({ username: username });
  }

  if (user) {
    await bcrypt
      .compare(password, user.password)

      .then((match) => {
        if (match) {
          const token = jwt.sign(
            {
              userID: user._id,
              username: user.username,
              email: user.email,
            },
            process.env.JWTSECRET,
            { expiresIn: "5h" }
          );

          return res.status(200).send({
            msg: "Logged in successfully!!!",
            token,
          });
        } else {
          return res.status(401).send({
            msg: "Password mismatch!!!",
          });
        }
      })
      .catch((err) => {
        console.log(err);
        return res.status(500).send({
          msg: err.message,
          err: err,
        });
      });
  } else {
    return res.status(404).send({
      msg: "User not found",
    });
  }
}

export async function getRoutes(req, res) {
  try {
    const domains = await route53.listHostedZones().promise();

    return res.status(200).send({
      data: domains,
      msg: "domains retrieved successfully!!!",
    });
  } catch (error) {
    return res.status(500).send({
      msg: error.message,
      error,
    });
  }
}

export async function getRegions(req, res) {
  try {
    const ec2 = new aws.EC2();
    const data = await ec2.describeRegions().promise();
    //console.log(data);
    const regions = data.Regions.map((region) => region.RegionName);
    // console.log(data.Regions)
    res.status(200).send({
      msg: "Regions retrieved successfully",
      data: regions,
    });
    console.log(regions);
  } catch (error) {
    console.error(error);
    res.status(500).send({
      msg: error.message,
      error: error,
    });
  }
}

export async function getVpcs(req, res) {
  try {
    const { region } = req.params;
    const ec2Regional = new aws.EC2({ region });

    const data = await ec2Regional.describeVpcs().promise();
    const vpcs = data.Vpcs.map((vpc) => vpc.VpcId);
    res.status(200).send({
      msg: "Vpc found !!",
      data: vpcs,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      msg: error.message,
      error,
    });
  }
}

export async function createHostedZone(req, res) {
  try {
    const { domainName, description, privateZone, vpcRegion, vpcId } = req.body;

    const existingHostedZones = await route53.listHostedZonesByName().promise();

    const hostedZoneExists = existingHostedZones.HostedZones.some(
      (zone) => zone.Name === domainName
    );

    if (hostedZoneExists) {
      return res.status(400).send({
        msg: "Hosted zone already exists with this name!!!",
      });
    }

    const params = {
      CallerReference: Date.now().toString(),
      Name: domainName,
      HostedZoneConfig: {
        Comment: description,
        PrivateZone: privateZone || false,
      },
    };

    if (privateZone) {
      params.VPC = {
        VPCRegion: vpcRegion,
        VPCId: vpcId,
      };
    }

    const data = await route53.createHostedZone(params).promise();

    return res.status(200).send({
      msg: "Hosted zone created successfully",
      data: data.HostedZone,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      msg: error.message,
      error: error,
    });
  }
}

const deletehostedzone = async (id) => {
  const { ResourceRecordSets } = await route53
    .listResourceRecordSets({
      HostedZoneId: id,
    })
    .promise();

  const changes = ResourceRecordSets.filter(
    (record) => record.Type !== "SOA" && record.Type !== "NS"
  ).map((record) => ({
    Action: "DELETE",
    ResourceRecordSet: record,
  }));

  if (changes.length > 0) {
    await route53
      .changeResourceRecordSets({
        ChangeBatch: {
          Changes: changes,
        },
        HostedZoneId: id,
      })
      .promise();
  }

  await route53
    .deleteHostedZone({
      Id: id,
    })
    .promise();
};
export async function deletehostedzones(req, res) {
  try {
    const zones = req.body;
    const deletionPromises = zones.map((hostedZoneId) =>
      deletehostedzone(hostedZoneId)
    );
    await Promise.all(deletionPromises);

    return res.status(200).send({
      msg: "Records and zones are deleted successfully",
    });
  } catch (error) {
    return res.status(500).send({
      msg: error.message,
      error,
    });
  }
}

export async function updateHostedZone(req, res) {
  const { id } = req.params;
  const { Comment } = req.body;

  try {
    const data = await route53
      .updateHostedZoneComment({ Id: "/hostedzone/" + id, Comment: Comment })
      .promise();
    return res.status(200).send({
      msg: "Updated hosted zone...",
      data,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      msg: error.message,
      error,
    });
  }
}

export async function getRecords(req, res) {
  try {
    const { hostedZoneID } = req.params;

    const data = await route53
      .listResourceRecordSets({
        HostedZoneId: "/hostedzone/" + hostedZoneID,
      })
      .promise();
    return res.status(200).send({
      msg: "records retrieved successfully",
      data,
    });
  } catch (error) {
    return res.status(500).send({
      msg: error.message,
      error,
    });
  }
}

export async function changeRecords(req, res) {
  try {
    const { hostedZoneId, changes } = req.body;
    console.log(changes);

    const data = await route53
      .changeResourceRecordSets({
        HostedZoneId: hostedZoneId,
        ChangeBatch: {
          Changes: changes,
        },
      })
      .promise();

    return res.status(200).send({
      msg: "changes has been done!!!",
      data,
    });
  } catch (error) {
    console.log(error);
    if (error.statusCode === 400) {
      return res.status(400).send({
        msg: "any DNS name is not acceptable!!!",
        error: error,
      });
    }

    return res.status(500).send({
      msg: error.message,
      error,
    });
  }
}
